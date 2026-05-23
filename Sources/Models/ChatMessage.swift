import Foundation

enum MessageSender: String, Codable, Equatable {
    case user
    case assistant
    case system
}

struct ChatMessage: Identifiable, Codable, Equatable {
    var id: UUID = UUID()
    var sender: MessageSender
    var text: String
    var timestamp: Date = Date()
}
