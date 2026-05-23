import Foundation

class AnthropicProvider: LLMProvider {
    
    private struct AnthropicRequest: Codable {
        struct Message: Codable {
            let role: String
            let content: String
        }
        let model: String
        let max_tokens: Int
        let system: String?
        let messages: [Message]
        let stream: Bool
    }
    
    private func maskKey(_ key: String) -> String {
        guard key.count > 10 else { return "********" }
        let prefix = key.prefix(7)
        let suffix = key.suffix(4)
        return "\(prefix)...\(suffix)"
    }
    
    func getResponseStream(
        history: [ChatMessage],
        concept: String?,
        isFeynmanMode: Bool,
        apiKey: String,
        apiURL: String,
        model: String
    ) -> AsyncThrowingStream<String, Error> {
        
        return AsyncThrowingStream { continuation in
            Task {
                guard !apiKey.isEmpty else {
                    let err = NSError(domain: "AnthropicProvider", code: 401, userInfo: [NSLocalizedDescriptionKey: "Anthropic API key is not configured. Please open Settings to set your key."])
                    LogManager.shared.log(level: .error, message: "Authentication failed: \(err.localizedDescription)")
                    continuation.finish(throwing: err)
                    return
                }
                
                var endpoint = apiURL.trimmingCharacters(in: .whitespacesAndNewlines)
                if !endpoint.contains("/messages") {
                    if endpoint.hasSuffix("/") {
                        endpoint += "v1/messages"
                    } else {
                        if endpoint.hasSuffix("/v1") {
                            endpoint += "/messages"
                        } else {
                            endpoint += "/v1/messages"
                        }
                    }
                }
                
                guard let url = URL(string: endpoint) else {
                    let err = NSError(domain: "AnthropicProvider", code: 400, userInfo: [NSLocalizedDescriptionKey: "Invalid API URL."])
                    LogManager.shared.log(level: .error, message: "URL validation failed: \(err.localizedDescription) (Input: \(apiURL))")
                    continuation.finish(throwing: err)
                    return
                }
                
                // Setup system instructions
                let systemText: String
                if isFeynmanMode, let concept = concept {
                    systemText = """
                    You are a strict learning evaluator in the ConceptNest app. The user is attempting to explain the concept of "\(concept)" in their own words.
                    Review their explanation carefully.
                    
                    Check list for evaluation:
                    1. ACCURACY: Is the core definition and mechanism described correctly?
                    2. CLARITY: Is it described simply, or is the user just repeating jargon they don't understand?
                    3. COMPLETENESS: Are there any critical misunderstandings or missing elements?
                    
                    EVALUATION CRITERIA:
                    - If their explanation shows a genuine, correct, and clear understanding, you MUST start your response with EXACTLY:
                      "EVALUATION: PASSED"
                      followed by a new line and a short, encouraging summary of why they succeeded.
                    - If their explanation is incorrect, too brief, copy-pasted, or lacks key structural details, you MUST start your response with EXACTLY:
                      "EVALUATION: FAILED"
                      followed by a new line, constructive feedback about what they missed or got wrong, and invite them to explain it again. Be strict.
                    """
                } else {
                    let conceptCtx = concept != nil ? " This thread is nested to explain the specific concept of: \"\(concept!)\"." : ""
                    systemText = """
                    You are a helpful learning assistant in the ConceptNest app.\(conceptCtx)
                    Help the user learn in a structured, clean, and inspiring way.
                    - Keep explanations simple and concise. Focus on analogies first to make it intuitive.
                    - Format key concepts or terms inside square brackets like [Concept Name] to make them stand out.
                    - Avoid overwhelming details. Let the user ask follow-up questions or dive into sub-branches for more details.
                    """
                }
                
                var messages: [AnthropicRequest.Message] = []
                for msg in history {
                    if msg.sender == .system { continue }
                    let role = msg.sender == .assistant ? "assistant" : "user"
                    messages.append(AnthropicRequest.Message(role: role, content: msg.text))
                }
                
                let payload = AnthropicRequest(
                    model: model,
                    max_tokens: 1024,
                    system: systemText,
                    messages: messages,
                    stream: true
                )
                
                var request = URLRequest(url: url)
                request.httpMethod = "POST"
                request.setValue("application/json", forHTTPHeaderField: "content-type")
                request.setValue(apiKey, forHTTPHeaderField: "x-api-key")
                request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
                do {
                    request.httpBody = try JSONEncoder().encode(payload)
                } catch {
                    LogManager.shared.log(level: .error, message: "Encoding request payload failed: \(error.localizedDescription)")
                    continuation.finish(throwing: error)
                    return
                }
                
                var requestLog = "Outgoing HTTP Request to \(url) (Streaming Mode)\nHeaders:\n  - content-type: application/json\n  - x-api-key: \(maskKey(apiKey))\n  - anthropic-version: 2023-06-01"
                if let jsonString = String(data: request.httpBody ?? Data(), encoding: .utf8) {
                    requestLog += "\nPayload:\n\(jsonString)"
                }
                LogManager.shared.log(level: .request, message: requestLog)
                
                do {
                    let (bytes, response) = try await URLSession.shared.bytes(for: request)
                    
                    guard let httpResponse = response as? HTTPURLResponse else {
                        let err = NSError(domain: "AnthropicProvider", code: 500, userInfo: [NSLocalizedDescriptionKey: "Invalid network response."])
                        LogManager.shared.log(level: .error, message: err.localizedDescription)
                        continuation.finish(throwing: err)
                        return
                    }
                    
                    guard httpResponse.statusCode == 200 else {
                        // Read error response body
                        var errorBytes = Data()
                        for try await byte in bytes {
                            errorBytes.append(byte)
                        }
                        let errorText = String(data: errorBytes, encoding: .utf8) ?? "Unknown HTTP error"
                        let err = NSError(domain: "AnthropicProvider", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: "API Error (HTTP \(httpResponse.statusCode)): \(errorText)"])
                        LogManager.shared.log(level: .error, message: "Request failed with status code \(httpResponse.statusCode). Response: \(errorText)")
                        continuation.finish(throwing: err)
                        return
                    }
                    
                    LogManager.shared.log(level: .info, message: "Connection established. Streaming response...")
                    
                    var accumulatedText = ""
                    for try await line in bytes.lines {
                        if line.hasPrefix("data: ") {
                            let jsonStr = line.dropFirst(6).trimmingCharacters(in: .whitespacesAndNewlines)
                            guard !jsonStr.isEmpty else { continue }
                            
                            if let data = jsonStr.data(using: .utf8) {
                                if let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                                    if let type = dict["type"] as? String {
                                        if type == "content_block_delta",
                                           let delta = dict["delta"] as? [String: Any],
                                           let text = delta["text"] as? String {
                                            accumulatedText += text
                                            continuation.yield(text)
                                        } else if type == "error",
                                                  let errorDict = dict["error"] as? [String: Any],
                                                  let message = errorDict["message"] as? String {
                                            let err = NSError(domain: "AnthropicProvider", code: 400, userInfo: [NSLocalizedDescriptionKey: message])
                                            LogManager.shared.log(level: .error, message: "API stream error: \(message)")
                                            continuation.finish(throwing: err)
                                            return
                                        }
                                    }
                                }
                            }
                        }
                    }
                    
                    LogManager.shared.log(level: .response, message: "Incoming HTTP Response Completed (Streaming Mode)\nAccumulated Body:\n\(accumulatedText)")
                    continuation.finish()
                    
                } catch {
                    LogManager.shared.log(level: .error, message: "Streaming operation failed with error: \(error.localizedDescription)")
                    continuation.finish(throwing: error)
                }
            }
        }
    }
}
