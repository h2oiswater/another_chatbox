import Foundation
import SwiftUI
import Combine

@Observable
class AppStore {
    var nodes: [ConceptNode] = []
    var selectedRootNodeID: UUID?
    
    // The recursive stack of active nested modal conversation IDs.
    // If empty, user is in the main chat. If items exist, they are in nested overlay sheets/modals.
    var modalStack: [UUID] = []
    
    var providerType: String = "anthropic" {
        didSet {
            UserDefaults.standard.set(providerType, forKey: "llm_provider_type")
        }
    }
    
    var apiKey: String = "" {
        didSet {
            UserDefaults.standard.set(apiKey, forKey: "anthropic_api_key")
        }
    }
    
    var apiURL: String = "https://api.anthropic.com" {
        didSet {
            UserDefaults.standard.set(apiURL, forKey: "anthropic_url")
        }
    }
    
    var selectedModel: String = "claude-3-5-sonnet-20241022" {
        didSet {
            UserDefaults.standard.set(selectedModel, forKey: "anthropic_model")
        }
    }
    
    var isSending: Bool = false
    var apiError: String? = nil
    
    init() {
        self.providerType = UserDefaults.standard.string(forKey: "llm_provider_type") ?? "anthropic"
        self.apiKey = UserDefaults.standard.string(forKey: "anthropic_api_key") ?? ""
        self.apiURL = UserDefaults.standard.string(forKey: "anthropic_url") ?? "https://api.anthropic.com"
        self.selectedModel = UserDefaults.standard.string(forKey: "anthropic_model") ?? "claude-3-5-sonnet-20241022"
        loadNodes()
        
        if nodes.isEmpty {
            seedWelcomeData()
        } else {
            // Select the most recent root node
            selectedRootNodeID = nodes.filter { $0.parentID == nil }
                .sorted(by: { $0.timestamp > $1.timestamp })
                .first?.id
        }
    }
    
    // MARK: - Persistence
    
    func saveNodes() {
        do {
            let data = try JSONEncoder().encode(nodes)
            UserDefaults.standard.set(data, forKey: "concept_nodes_data")
        } catch {
            print("Failed to save nodes: \(error)")
        }
    }
    
    private func loadNodes() {
        guard let data = UserDefaults.standard.data(forKey: "concept_nodes_data") else { return }
        do {
            nodes = try JSONDecoder().decode([ConceptNode].self, from: data)
        } catch {
            print("Failed to load nodes: \(error)")
        }
    }
    
    // MARK: - Node Operations
    
    func createNewRootNode(title: String) {
        let newNode = ConceptNode(title: title, parentID: nil, conceptToExplain: title)
        nodes.append(newNode)
        selectedRootNodeID = newNode.id
        saveNodes()
        
        // Trigger initial greeting from Assistant
        Task {
            await getLLMReply(for: newNode.id, initialPrompt: "Introduce the topic of '\(title)' in a clean, high-level way. End by asking what specific aspect they want to look at first.")
        }
    }
    
    func spawnChildNode(parentID: UUID, concept: String, customPrompt: String? = nil) -> UUID {
        let cleanConcept = concept.trimmingCharacters(in: .whitespacesAndNewlines)
        // Check if there is already a child node with the same concept to prevent duplicates
        if let existing = nodes.first(where: { $0.parentID == parentID && $0.conceptToExplain.lowercased() == cleanConcept.lowercased() }) {
            return existing.id
        }
        
        var childNode = ConceptNode(
            title: cleanConcept,
            parentID: parentID,
            conceptToExplain: cleanConcept
        )
        
        let initialPromptText = customPrompt ?? "Explain the concept of '\(cleanConcept)' simply with a clear analogy. Format key terms inside square brackets like [Concept Name]."
        
        // Append user prompt as first visible message in conversation
        let userMsg = ChatMessage(sender: .user, text: initialPromptText)
        childNode.messages.append(userMsg)
        
        nodes.append(childNode)
        saveNodes()
        
        // Trigger initial response in background
        Task {
            await getLLMReply(for: childNode.id)
        }
        
        return childNode.id
    }
    
    func getChildNodes(for parentID: UUID) -> [ConceptNode] {
        return nodes.filter { $0.parentID == parentID }
            .sorted(by: { $0.timestamp < $1.timestamp })
    }
    
    func deleteNode(id: UUID) {
        // Collect all IDs to delete recursively
        var idsToDelete = Set<UUID>([id])
        var checkQueue = [id]
        
        while !checkQueue.isEmpty {
            let current = checkQueue.removeFirst()
            let children = nodes.filter { $0.parentID == current }.map { $0.id }
            for childID in children {
                if !idsToDelete.contains(childID) {
                    idsToDelete.insert(childID)
                    checkQueue.append(childID)
                }
            }
        }
        
        // Remove from list
        nodes.removeAll { idsToDelete.contains($0.id) }
        
        // Clean up UI state
        if let selected = selectedRootNodeID, idsToDelete.contains(selected) {
            selectedRootNodeID = nodes.filter { $0.parentID == nil }
                .sorted(by: { $0.timestamp > $1.timestamp })
                .first?.id
        }
        
        modalStack.removeAll { idsToDelete.contains($0) }
        
        saveNodes()
    }
    
    func updateNodeStatus(id: UUID, status: NodeStatus) {
        if let idx = nodes.firstIndex(where: { $0.id == id }) {
            nodes[idx].status = status
            saveNodes()
        }
    }
    
    func toggleFeynmanMode(id: UUID, enabled: Bool) {
        if let idx = nodes.firstIndex(where: { $0.id == id }) {
            nodes[idx].feynmanMode = enabled
            
            if enabled {
                // Insert a system guiding instruction message from the evaluator
                let prompt = "Explain '\(nodes[idx].conceptToExplain)' in your own words to master this card. I will review your accuracy, simplicity, and identify any gaps."
                let evaluatorMsg = ChatMessage(sender: .assistant, text: prompt)
                nodes[idx].messages.append(evaluatorMsg)
            } else {
                // If exiting feynman mode, clear the feynman evaluation messages to clean history
                // (or keep them - but clearing helps return to normal chat focus)
            }
            saveNodes()
        }
    }
    
    // MARK: - Chat Operations
    
    func sendUserMessage(to nodeID: UUID, text: String) async {
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        
        guard let idx = nodes.firstIndex(where: { $0.id == nodeID }) else { return }
        let userMsg = ChatMessage(sender: .user, text: text)
        
        // UI Update (must run on MainActor/main thread)
        await MainActor.run {
            nodes[idx].messages.append(userMsg)
            isSending = true
            apiError = nil
        }
        saveNodes()
        
        // Call API
        await getLLMReply(for: nodeID)
    }
    
    private func getLLMReply(for nodeID: UUID, initialPrompt: String? = nil) async {
        guard let idx = nodes.firstIndex(where: { $0.id == nodeID }) else { return }
        let node = nodes[idx]
        
        var chatHistory = node.messages
        if let initPrompt = initialPrompt {
            // Setup a fake initial user question to seed the system response
            chatHistory.insert(ChatMessage(sender: .user, text: initPrompt), at: 0)
        }
        
        // Append initial empty message
        let newMsg = ChatMessage(sender: .assistant, text: "")
        let newMsgID = newMsg.id
        
        await MainActor.run {
            if let uIdx = nodes.firstIndex(where: { $0.id == nodeID }) {
                nodes[uIdx].messages.append(newMsg)
                isSending = true
                apiError = nil
            }
        }
        
        do {
            let isFeynman = node.feynmanMode
            
            let stream = LLMClient.shared.getResponseStream(
                providerType: providerType,
                history: chatHistory,
                concept: node.conceptToExplain,
                isFeynmanMode: isFeynman,
                apiKey: apiKey,
                apiURL: apiURL,
                model: selectedModel
            )
            
            var accumulatedText = ""
            for try await chunk in stream {
                accumulatedText += chunk
                
                let currentText = accumulatedText
                await MainActor.run {
                    if let uIdx = nodes.firstIndex(where: { $0.id == nodeID }),
                       let mIdx = nodes[uIdx].messages.firstIndex(where: { $0.id == newMsgID }) {
                        nodes[uIdx].messages[mIdx].text = currentText
                    }
                }
            }
            
            let finalAccumulatedText = accumulatedText
            await MainActor.run {
                if let uIdx = nodes.firstIndex(where: { $0.id == nodeID }),
                   let mIdx = nodes[uIdx].messages.firstIndex(where: { $0.id == newMsgID }) {
                    
                    var finalReply = finalAccumulatedText
                    if isFeynman {
                        // Strict gate check!
                        if finalAccumulatedText.hasPrefix("EVALUATION: PASSED") {
                            nodes[uIdx].status = .mastered
                            nodes[uIdx].feynmanMode = false
                            
                            // Propagate mastery summary upward if there is a parent!
                            if let parentID = nodes[uIdx].parentID {
                                injectMasterySummaryToParent(parentID: parentID, concept: nodes[uIdx].conceptToExplain, explanation: finalAccumulatedText)
                            }
                            
                            // Strip EVALUATION header for UI cleanliness
                            finalReply = finalAccumulatedText.replacingOccurrences(of: "EVALUATION: PASSED\n", with: "")
                                                         .replacingOccurrences(of: "EVALUATION: PASSED", with: "")
                        } else if finalAccumulatedText.hasPrefix("EVALUATION: FAILED") {
                            // Strip header
                            finalReply = finalAccumulatedText.replacingOccurrences(of: "EVALUATION: FAILED\n", with: "")
                                                         .replacingOccurrences(of: "EVALUATION: FAILED", with: "")
                        }
                    }
                    
                    nodes[uIdx].messages[mIdx].text = finalReply
                    isSending = false
                }
            }
            saveNodes()
        } catch {
            await MainActor.run {
                apiError = error.localizedDescription
                isSending = false
                
                // If the message is still empty, remove it to clean up the UI
                if let uIdx = nodes.firstIndex(where: { $0.id == nodeID }),
                   let mIdx = nodes[uIdx].messages.firstIndex(where: { $0.id == newMsgID }) {
                    if nodes[uIdx].messages[mIdx].text.isEmpty {
                        nodes[uIdx].messages.remove(at: mIdx)
                    }
                }
            }
        }
    }
    
    private func injectMasterySummaryToParent(parentID: UUID, concept: String, explanation: String) {
        guard let pIdx = nodes.firstIndex(where: { $0.id == parentID }) else { return }
        let summary = "System Update: The user has successfully mastered the concept of '\(concept)' with explanation: \(explanation.replacingOccurrences(of: "EVALUATION: PASSED\n", with: ""))"
        let systemMsg = ChatMessage(sender: .system, text: summary)
        nodes[pIdx].messages.append(systemMsg)
        saveNodes()
    }
    
    // MARK: - Seeding
    
    private func seedWelcomeData() {
        let welcomeNode = ConceptNode(
            title: "Welcome to ConceptNest! 🪹",
            parentID: nil,
            conceptToExplain: "ConceptNest"
        )
        
        let introMsg = ChatMessage(
            sender: .assistant,
            text: """
            Welcome to **ConceptNest**! I'm here to help you study and learn complex ideas without losing your flow.

            Here's how this app works:
            1. **Ask questions** about any topic in this middle panel.
            2. When I reply with a complex term you don't fully understand (for example, [Neural Networks] or [Vector Embeddings]), you can **select and copy** that phrase, and click **"+ Create Branch"** in the right panel to spawn a nested thread.
            3. Alternatively, you can **right-click** this message and choose "Create Concept from Clipboard" to launch a branch.
            4. The child node will appear in the right sidebar in **Yellow** (meaning it's not yet mastered).
            5. Click on the child card in the right sidebar. It will scale up as a nested modal where you can talk to it privately.
            6. When you feel you understand it, click **"Master Concept"** (the Feynman Technique!). You will be prompted to explain the concept in your own words.
            7. If your explanation satisfies the strict evaluator, the card turns **Green** (Mastered), and the summary is automatically fed back to my parent context!

            What topic would you like to explore today?
            """
        )
        
        var node = welcomeNode
        node.messages.append(introMsg)
        nodes.append(node)
        selectedRootNodeID = node.id
        saveNodes()
    }
}
