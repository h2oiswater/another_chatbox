import Foundation

enum NodeStatus: String, Codable, Equatable {
    case notMastered = "yellow"
    case mastered = "green"
}

struct ConceptNode: Identifiable, Codable, Equatable {
    var id: UUID = UUID()
    var title: String
    var parentID: UUID?
    var messages: [ChatMessage] = []
    var status: NodeStatus = .notMastered
    var feynmanMode: Bool = false
    var conceptToExplain: String
    var timestamp: Date = Date()
}
