import SwiftUI

struct SettingsView: View {
    @Bindable var store: AppStore
    @Environment(\.dismiss) private var dismiss
    @State private var selectedTab = 0
    
    private var logsText: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm:ss.SSS"
        return LogManager.shared.logs.map { entry in
            "[\(formatter.string(from: entry.timestamp))] [\(entry.level.rawValue)] \(entry.message)"
        }.joined(separator: "\n")
    }
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Image(systemName: "gearshape.fill")
                    .font(.largeTitle)
                    .foregroundStyle(.blue.gradient)
                VStack(alignment: .leading, spacing: 4) {
                    Text("Settings & Diagnostics")
                        .font(.title2)
                        .fontWeight(.bold)
                    Text("Configure connections and monitor API client activity")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                Spacer()
            }
            .padding(.horizontal, 24)
            .padding(.top, 24)
            .padding(.bottom, 16)
            
            Divider()
            
            // Tab Content
            TabView(selection: $selectedTab) {
                // Tab 1: API Settings
                Form {
                    Section {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("LLM Provider")
                                .font(.headline)
                            Picker("", selection: $store.providerType) {
                                Text("Anthropic Claude").tag("anthropic")
                                Text("OpenAI Compatible").tag("openai")
                            }
                            .pickerStyle(.segmented)
                            .onChange(of: store.providerType) { _, newValue in
                                if newValue == "anthropic" {
                                    if store.apiURL.contains("openai.com") || store.apiURL.isEmpty {
                                        store.apiURL = "https://api.anthropic.com"
                                    }
                                    if store.selectedModel.contains("gpt") || store.selectedModel.isEmpty {
                                        store.selectedModel = "claude-3-5-sonnet-20241022"
                                    }
                                } else {
                                    if store.apiURL.contains("anthropic.com") || store.apiURL.isEmpty {
                                        store.apiURL = "https://api.openai.com"
                                    }
                                    if store.selectedModel.contains("claude") || store.selectedModel.isEmpty {
                                        store.selectedModel = "gpt-4o"
                                    }
                                }
                            }
                        }
                        .padding(.vertical, 4)
                        
                        VStack(alignment: .leading, spacing: 6) {
                            Text("API Base URL")
                                .font(.headline)
                            
                            TextField(store.providerType == "anthropic" ? "https://api.anthropic.com" : "https://api.openai.com", text: $store.apiURL)
                                .textFieldStyle(.roundedBorder)
                            
                            Text("You can enter a custom proxy or provider endpoint if needed.")
                                .font(.caption2)
                                .foregroundColor(.secondary)
                        }
                        .padding(.vertical, 4)
                        
                        VStack(alignment: .leading, spacing: 6) {
                            Text("API Key")
                                .font(.headline)
                            
                            SecureField(store.providerType == "anthropic" ? "sk-ant-..." : "sk-...", text: $store.apiKey)
                                .textFieldStyle(.roundedBorder)
                                .font(.system(.body, design: .monospaced))
                        }
                        .padding(.vertical, 4)
                        
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Model Name")
                                .font(.headline)
                            
                            TextField("model-name", text: $store.selectedModel)
                                .textFieldStyle(.roundedBorder)
                            
                            HStack(spacing: 6) {
                                Text("Suggestions:")
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                                
                                if store.providerType == "anthropic" {
                                    Button("Claude 3.5 Sonnet") {
                                        store.selectedModel = "claude-3-5-sonnet-20241022"
                                    }
                                    .buttonStyle(.bordered)
                                    .controlSize(.small)
                                    
                                    Button("Claude 3 Haiku") {
                                        store.selectedModel = "claude-3-haiku-20240307"
                                    }
                                    .buttonStyle(.bordered)
                                    .controlSize(.small)
                                } else {
                                    Button("GPT-4o") {
                                        store.selectedModel = "gpt-4o"
                                    }
                                    .buttonStyle(.bordered)
                                    .controlSize(.small)
                                    
                                    Button("GPT-4o Mini") {
                                        store.selectedModel = "gpt-4o-mini"
                                    }
                                    .buttonStyle(.bordered)
                                    .controlSize(.small)
                                    
                                    Button("Llama 3.1 (OpenRouter)") {
                                        store.selectedModel = "meta-llama/llama-3.1-70b-instruct"
                                        store.apiURL = "https://openrouter.ai/api"
                                    }
                                    .buttonStyle(.bordered)
                                    .controlSize(.small)
                                }
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }
                .tabItem {
                    Label("API Settings", systemImage: "slider.horizontal.3")
                }
                .tag(0)
                
                // Tab 2: Logs Console
                VStack(alignment: .leading, spacing: 12) {
                    ScrollView {
                        ScrollViewReader { proxy in
                            VStack(alignment: .leading, spacing: 0) {
                                Text(logsText.isEmpty ? "No requests logged yet." : logsText)
                                    .font(.system(.body, design: .monospaced))
                                    .foregroundColor(.primary)
                                    .multilineTextAlignment(.leading)
                                    .textSelection(.enabled)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .id("LogText")
                            }
                            .padding(12)
                            .onChange(of: LogManager.shared.logs.count) {
                                withAnimation {
                                    proxy.scrollTo("LogText", anchor: .bottom)
                                }
                            }
                        }
                    }
                    .background(Color(nsColor: .textBackgroundColor))
                    .cornerRadius(6)
                    .border(Color.secondary.opacity(0.2), width: 1)
                    
                    HStack(spacing: 12) {
                        Button(action: {
                            NSPasteboard.general.clearContents()
                            NSPasteboard.general.setString(logsText, forType: .string)
                        }) {
                            Label("Copy Logs", systemImage: "doc.on.doc")
                        }
                        .disabled(logsText.isEmpty)
                        
                        Button(action: {
                            LogManager.shared.clear()
                        }) {
                            Label("Clear", systemImage: "trash")
                        }
                        
                        if let logURL = LogManager.shared.getLogFileURL() {
                            Button(action: {
                                NSWorkspace.shared.activateFileViewerSelecting([logURL])
                            }) {
                                Label("Reveal in Finder", systemImage: "folder")
                            }
                        }
                        
                        Spacer()
                    }
                }
                .padding(.top, 8)
                .tabItem {
                    Label("API Console Logs", systemImage: "terminal")
                }
                .tag(1)
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 16)
            
            Divider()
            
            // Actions
            HStack {
                Spacer()
                Button("Done") {
                    dismiss()
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 16)
        }
        .frame(width: 640, height: 500)
    }
}
