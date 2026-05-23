import Foundation
import Observation

enum LogLevel: String {
    case info = "INFO"
    case error = "ERROR"
    case request = "REQUEST"
    case response = "RESPONSE"
}

struct LogEntry: Identifiable {
    let id = UUID()
    let timestamp: Date
    let level: LogLevel
    let message: String
}

@Observable
class LogManager {
    static let shared = LogManager()
    
    var logs: [LogEntry] = []
    private let maxLogCount = 1000
    private var logFileURL: URL?
    
    private init() {
        if let libraryURL = FileManager.default.urls(for: .libraryDirectory, in: .userDomainMask).first {
            let logsDir = libraryURL.appendingPathComponent("Logs/ConceptNest", isDirectory: true)
            try? FileManager.default.createDirectory(at: logsDir, withIntermediateDirectories: true)
            logFileURL = logsDir.appendingPathComponent("api.log")
        }
        log(level: .info, message: "ConceptNest application started. Log file initialized.")
    }
    
    func log(level: LogLevel, message: String) {
        let entry = LogEntry(timestamp: Date(), level: level, message: message)
        
        // Print to console/stdout
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd HH:mm:ss.SSS"
        let dateString = formatter.string(from: entry.timestamp)
        let logLine = "[\(dateString)] [\(level.rawValue)] \(message)\n"
        print(logLine, terminator: "")
        
        // Write to log file on a background queue
        if let url = logFileURL {
            DispatchQueue.global(qos: .utility).async {
                if let data = logLine.data(using: .utf8) {
                    if FileManager.default.fileExists(atPath: url.path) {
                        if let fileHandle = try? FileHandle(forWritingTo: url) {
                            fileHandle.seekToEndOfFile()
                            fileHandle.write(data)
                            fileHandle.closeFile()
                        }
                    } else {
                        try? data.write(to: url)
                    }
                }
            }
        }
        
        // Append to UI logs buffer on main thread
        DispatchQueue.main.async {
            self.logs.append(entry)
            if self.logs.count > self.maxLogCount {
                self.logs.removeFirst()
            }
        }
    }
    
    func clear() {
        DispatchQueue.main.async {
            self.logs.removeAll()
        }
        if let url = logFileURL {
            try? "".write(to: url, atomically: true, encoding: .utf8)
        }
    }
    
    func getLogFileURL() -> URL? {
        return logFileURL
    }
}
