import Foundation

protocol LLMProvider {
    func getResponseStream(
        history: [ChatMessage],
        concept: String?,
        isFeynmanMode: Bool,
        apiKey: String,
        apiURL: String,
        model: String
    ) -> AsyncThrowingStream<String, Error>
}

class LLMProviderFactory {
    static func makeProvider(for type: String) -> LLMProvider {
        switch type.lowercased() {
        case "openai":
            return OpenAIProvider()
        default:
            return AnthropicProvider()
        }
    }
}
