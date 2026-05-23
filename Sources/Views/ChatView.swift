import SwiftUI

struct ChatView: View {
    let nodeID: UUID
    @Bindable var store: AppStore
    
    @State private var inputText: String = ""
    @State private var showSpawnDialog: Bool = false
    @State private var spawnConceptText: String = ""
    @State private var customPromptText: String = ""
    @State private var clipboardText: String = ""
    @State private var lastChangeCount: Int = 0
    @State private var clipboardTimer: Timer? = nil
    @FocusState private var isFocused: Bool
    
    var body: some View {
        if let node = store.nodes.first(where: { $0.id == nodeID }) {
            VStack(spacing: 0) {
                // Chat Header
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack(spacing: 8) {
                            Text(node.title)
                                .font(.title3)
                                .fontWeight(.bold)
                            
                            // Status Badge
                            Text(node.status == .mastered ? "Mastered" : "Learning")
                                .font(.caption2)
                                .fontWeight(.bold)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 3)
                                .background(node.status == .mastered ? Color.green.opacity(0.2) : Color.yellow.opacity(0.2))
                                .foregroundColor(node.status == .mastered ? .green : .orange)
                                .cornerRadius(8)
                        }
                        
                        if node.parentID != nil {
                            Text("Explaining concept in parent thread")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                    
                    Spacer()
                    
                    // Feynman Master Button
                    if node.status != .mastered {
                        Button(action: {
                            store.toggleFeynmanMode(id: node.id, enabled: !node.feynmanMode)
                        }) {
                            HStack {
                                Image(systemName: node.feynmanMode ? "arrow.left.circle" : "graduationcap.fill")
                                Text(node.feynmanMode ? "Exit Exam" : "Master Concept")
                            }
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(node.feynmanMode ? .gray : .orange)
                    }
                }
                .padding()
                .background(Color(NSColor.windowBackgroundColor))
                
                Divider()
                
                // Feynman Instruction Banner
                if node.feynmanMode {
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Image(systemName: "lightbulb.fill")
                                .foregroundColor(.orange)
                            Text("Strict Gate active recall check")
                                .font(.headline)
                        }
                        Text("Explain **\(node.conceptToExplain)** in your own words below. The LLM will evaluate your explanation strictly. You must pass to master the card.")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                    .padding()
                    .background(Color.orange.opacity(0.1))
                    .cornerRadius(8)
                    .padding()
                }
                
                // Chat Messages Scroll
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(spacing: 16) {
                            ForEach(node.messages) { message in
                                MessageBubble(message: message, onConceptClicked: { concept in
                                    spawnConceptText = concept
                                    customPromptText = "Explain \(concept) simply with a clear analogy. Format key terms inside square brackets like [Concept Name]."
                                    showSpawnDialog = true
                                })
                            }
                            
                            if store.isSending {
                                HStack {
                                    ProgressView()
                                        .controlSize(.small)
                                    Text("AI is thinking...")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                    Spacer()
                                }
                                .padding(.horizontal)
                                .id("loading_indicator")
                            }
                        }
                        .padding()
                    }
                    .onChange(of: node.messages.count) {
                        if let lastMsg = node.messages.last {
                            withAnimation {
                                proxy.scrollTo(lastMsg.id, anchor: .bottom)
                            }
                        }
                    }
                    .onChange(of: store.isSending) {
                        if store.isSending {
                            withAnimation {
                                proxy.scrollTo("loading_indicator", anchor: .bottom)
                            }
                        }
                    }
                }
                
                Divider()
                
                // Error Banner
                if let error = store.apiError {
                    HStack {
                        Text(error)
                            .font(.caption)
                            .foregroundColor(.red)
                        Spacer()
                        Button(action: { store.apiError = nil }) {
                            Image(systemName: "xmark.circle")
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(.horizontal)
                    .padding(.vertical, 8)
                    .background(Color.red.opacity(0.1))
                }
                
                // Selection Branch helper
                if !clipboardText.isEmpty {
                    HStack {
                        Button(action: {
                            spawnConceptText = clipboardText
                            customPromptText = "Explain \(clipboardText) simply with a clear analogy."
                            showSpawnDialog = true
                        }) {
                            HStack(spacing: 6) {
                                Image(systemName: "arrow.triangle.branch")
                                Text("Branch selection: \"\(clipboardText)\"")
                                    .fontWeight(.medium)
                            }
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(Color.orange.opacity(0.15))
                            .foregroundColor(.orange)
                            .cornerRadius(6)
                        }
                        .buttonStyle(.plain)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                        
                        Spacer()
                    }
                    .padding(.horizontal)
                    .padding(.bottom, 8)
                }
                
                // Input Bar
                HStack(spacing: 12) {
                    TextField(node.feynmanMode ? "Explain \(node.conceptToExplain) in your own words..." : "Ask a question about this concept...", text: $inputText)
                        .textFieldStyle(.plain)
                        .padding(10)
                        .background(Color(NSColor.controlBackgroundColor))
                        .cornerRadius(8)
                        .focused($isFocused)
                        .onSubmit {
                            sendMessage()
                        }
                    
                    Button(action: sendMessage) {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.title2)
                            .foregroundColor(inputText.isEmpty ? .secondary : .blue)
                    }
                    .buttonStyle(.plain)
                    .disabled(inputText.isEmpty || store.isSending)
                }
                .padding()
                .background(Color(NSColor.windowBackgroundColor))
            }
            .sheet(isPresented: $showSpawnDialog) {
                VStack(alignment: .leading, spacing: 16) {
                    Text(spawnConceptText)
                        .font(.title2)
                        .fontWeight(.bold)
                        .foregroundColor(.primary)
                    
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Initial Question / Prompt")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                        
                        TextEditor(text: $customPromptText)
                            .font(.body)
                            .frame(height: 100)
                            .padding(6)
                            .background(Color(NSColor.controlBackgroundColor))
                            .cornerRadius(6)
                            .border(Color.secondary.opacity(0.2), width: 1)
                    }
                    
                    HStack {
                        Spacer()
                        
                        Button("Cancel") {
                            showSpawnDialog = false
                        }
                        .keyboardShortcut(.cancelAction)
                        
                        Button("Confirm") {
                            let concept = spawnConceptText.trimmingCharacters(in: .whitespacesAndNewlines)
                            let prompt = customPromptText.trimmingCharacters(in: .whitespacesAndNewlines)
                            if !concept.isEmpty {
                                let childID = store.spawnChildNode(parentID: node.id, concept: concept, customPrompt: prompt.isEmpty ? nil : prompt)
                                store.modalStack.append(childID)
                            }
                            showSpawnDialog = false
                        }
                        .buttonStyle(.borderedProminent)
                        .keyboardShortcut(.defaultAction)
                        .disabled(customPromptText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    }
                }
                .padding(20)
                .frame(width: 420, height: 240)
            }
            .onAppear {
                lastChangeCount = NSPasteboard.general.changeCount
                // Check if clipboard already has a valid concept to seed it on load
                if let clip = NSPasteboard.general.string(forType: .string) {
                    let trimmed = clip.trimmingCharacters(in: .whitespacesAndNewlines)
                    if trimmed.count > 0 && trimmed.count < 60 && !trimmed.contains("\n") {
                        clipboardText = trimmed
                    }
                }
                
                clipboardTimer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { _ in
                    let changeCount = NSPasteboard.general.changeCount
                    if changeCount != lastChangeCount {
                        lastChangeCount = changeCount
                        if let clip = NSPasteboard.general.string(forType: .string) {
                            let trimmed = clip.trimmingCharacters(in: .whitespacesAndNewlines)
                            if trimmed.count > 0 && trimmed.count < 60 && !trimmed.contains("\n") {
                                withAnimation {
                                    clipboardText = trimmed
                                }
                            } else {
                                withAnimation {
                                    clipboardText = ""
                                }
                            }
                        }
                    }
                }
            }
            .onDisappear {
                clipboardTimer?.invalidate()
                clipboardTimer = nil
            }
        } else {
            VStack {
                Text("Select a conversation to start learning")
                    .foregroundColor(.secondary)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
    
    private func sendMessage() {
        let text = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        
        inputText = ""
        Task {
            await store.sendUserMessage(to: nodeID, text: text)
        }
    }
}

// MARK: - Message Bubble Component

struct MessageBubble: View {
    let message: ChatMessage
    let onConceptClicked: (String) -> Void
    
    var body: some View {
        VStack(alignment: message.sender == .user ? .trailing : .leading, spacing: 4) {
            // Role tag for clarity in System reports
            if message.sender == .system {
                HStack {
                    Spacer()
                    Text("System Integration Summary")
                        .font(.caption2)
                        .foregroundColor(.green)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 2)
                        .background(Color.green.opacity(0.1))
                        .cornerRadius(4)
                    Spacer()
                }
                .padding(.vertical, 4)
            }
            
            HStack {
                if message.sender == .user { Spacer() }
                
                VStack(alignment: .leading, spacing: 8) {
                    if message.sender == .system {
                        Text(message.text)
                            .font(.system(.subheadline, design: .monospaced))
                            .foregroundColor(.secondary)
                            .padding(10)
                            .background(Color.green.opacity(0.05))
                            .cornerRadius(8)
                            .frame(maxWidth: 550)
                    } else {
                        // Render styled text inside bubble
                        FormattedMessageView(text: message.text, isUser: message.sender == .user, onConceptClicked: onConceptClicked)
                            .padding(12)
                            .background(message.sender == .user ? Color.blue.gradient : Color(NSColor.controlBackgroundColor).gradient)
                            .cornerRadius(12)
                            .frame(maxWidth: 550)
                    }
                }
                
                if message.sender != .user { Spacer() }
            }
        }
    }
}

// MARK: - Formatted Message Parser View

struct FormattedMessageView: View {
    let text: String
    let isUser: Bool
    let onConceptClicked: (String) -> Void
    
    var body: some View {
        SelectableTextView(text: text, isUser: isUser, onConceptSelected: onConceptClicked)
    }
}

// MARK: - Custom NSTextView selection helper

struct SelectableTextView: View {
    let text: String
    let isUser: Bool
    let onConceptSelected: (String) -> Void
    
    @State private var dynamicHeight: CGFloat = 20
    
    var body: some View {
        RepresentableSelectableTextView(text: text, isUser: isUser, dynamicHeight: $dynamicHeight, onConceptSelected: onConceptSelected)
            .frame(height: dynamicHeight)
    }
}

struct RepresentableSelectableTextView: NSViewRepresentable {
    let text: String
    let isUser: Bool
    @Binding var dynamicHeight: CGFloat
    let onConceptSelected: (String) -> Void
    
    func makeNSView(context: Context) -> NSTextView {
        let textView = NSTextView()
        textView.isEditable = false
        textView.isSelectable = true
        textView.drawsBackground = false
        textView.textContainer?.lineFragmentPadding = 0
        textView.textContainerInset = .zero
        
        textView.font = NSFont.systemFont(ofSize: 13)
        textView.delegate = context.coordinator
        
        textView.isVerticallyResizable = true
        textView.isHorizontallyResizable = false
        textView.autoresizingMask = [.width]
        textView.textContainer?.widthTracksTextView = true
        
        return textView
    }
    
    func updateNSView(_ nsView: NSTextView, context: Context) {
        context.coordinator.onConceptSelected = onConceptSelected
        context.coordinator.fullText = text
        
        let attributed = parseTextToAttributedString(text, isUser: isUser)
        if nsView.textStorage?.string != attributed.string {
            nsView.textStorage?.setAttributedString(attributed)
        }
        
        if let layoutManager = nsView.layoutManager, let textContainer = nsView.textContainer {
            layoutManager.ensureLayout(for: textContainer)
            let size = layoutManager.usedRect(for: textContainer).size
            let newHeight = size.height + 4
            if abs(dynamicHeight - newHeight) > 0.5 {
                DispatchQueue.main.async {
                    self.dynamicHeight = newHeight
                }
            }
        }
    }
    
    func makeCoordinator() -> Coordinator {
        Coordinator(onConceptSelected: onConceptSelected)
    }
    
    class Coordinator: NSObject, NSTextViewDelegate {
        var onConceptSelected: (String) -> Void
        var fullText: String = ""
        
        init(onConceptSelected: @escaping (String) -> Void) {
            self.onConceptSelected = onConceptSelected
        }
        
        func textView(_ textView: NSTextView, menu: NSMenu, for event: NSEvent, at charIndex: Int) -> NSMenu? {
            // Build a clean menu instead of augmenting the default one so SwiftUI
            // items from any residual gesture recognizers cannot bleed through.
            let freshMenu = NSMenu()
            
            // "Copy Message Text" — always available; copies the full bubble text.
            let copyItem = NSMenuItem(
                title: "Copy Message Text",
                action: #selector(triggerCopyFullText(_:)),
                keyEquivalent: ""
            )
            copyItem.target = self
            freshMenu.addItem(copyItem)
            
            // "Create Concept from Selection" — only when text is selected.
            let range = textView.selectedRange()
            if range.length > 0 {
                let selectedText = (textView.string as NSString).substring(with: range)
                let trimmed = selectedText.trimmingCharacters(in: .whitespacesAndNewlines)
                if !trimmed.isEmpty {
                    freshMenu.addItem(NSMenuItem.separator())
                    
                    let conceptItem = NSMenuItem(
                        title: "Create Concept from Selection",
                        action: #selector(triggerCreateConcept(_:)),
                        keyEquivalent: ""
                    )
                    conceptItem.target = self
                    conceptItem.representedObject = trimmed
                    freshMenu.addItem(conceptItem)
                }
            }
            
            return freshMenu
        }
        
        @objc private func triggerCopyFullText(_ sender: NSMenuItem) {
            NSPasteboard.general.clearContents()
            NSPasteboard.general.setString(fullText, forType: .string)
        }
        
        @objc private func triggerCreateConcept(_ sender: NSMenuItem) {
            if let selectedText = sender.representedObject as? String {
                onConceptSelected(selectedText)
            }
        }
    }
    
    private func parseTextToAttributedString(_ text: String, isUser: Bool) -> NSAttributedString {
        let pattern = "\\[([^\\]]+)\\]"
        let nsString = text as NSString
        let attributed = NSMutableAttributedString(string: text, attributes: [
            .font: NSFont.systemFont(ofSize: 13),
            .foregroundColor: isUser ? NSColor.white : NSColor.textColor
        ])
        
        guard let regex = try? NSRegularExpression(pattern: pattern, options: []) else {
            return attributed
        }
        
        let matches = regex.matches(in: text, options: [], range: NSRange(location: 0, length: nsString.length))
        for match in matches {
            let fullRange = match.range
            attributed.addAttribute(.foregroundColor, value: isUser ? NSColor.white : NSColor.systemOrange, range: fullRange)
            attributed.addAttribute(.underlineStyle, value: NSUnderlineStyle.single.rawValue, range: fullRange)
            attributed.addAttribute(.font, value: NSFont.boldSystemFont(ofSize: 13), range: fullRange)
        }
        
        return attributed
    }
}

// MARK: - FlowLayout Component (Self-Wrapping Grid for tags)

struct FlowLayout<T: Hashable, V: View>: View {
    let spacing: CGFloat
    let items: [T]
    let content: (T) -> V
    
    @State private var totalHeight = CGFloat.zero // Need this to wrap layout properly
    
    var body: some View {
        VStack {
            GeometryReader { geometry in
                self.generateContent(in: geometry)
            }
        }
        .frame(height: totalHeight) // Dynamic binding
    }
    
    private func generateContent(in g: GeometryProxy) -> some View {
        var width = CGFloat.zero
        var height = CGFloat.zero
        
        return ZStack(alignment: .topLeading) {
            ForEach(items, id: \.self) { item in
                self.content(item)
                    .padding([.horizontal, .vertical], 0)
                    .alignmentGuide(.leading) { d in
                        if (abs(width - d.width) > g.size.width) {
                            width = 0
                            height -= d.height + self.spacing
                        }
                        let result = width
                        if item == self.items.last {
                            width = 0 // Last item reset
                        } else {
                            width -= d.width + self.spacing
                        }
                        return result
                    }
                    .alignmentGuide(.top) { d in
                        let result = height
                        if item == self.items.last {
                            height = 0 // Last item reset
                        }
                        return result
                    }
            }
        }
        .background(
            GeometryReader { geo in
                Color.clear.onAppear {
                    self.totalHeight = geo.size.height
                }
                .onChange(of: geo.size.height) { _, newValue in
                    self.totalHeight = newValue
                }
            }
        )
    }
}
