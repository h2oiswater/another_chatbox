import SwiftUI

struct ContentView: View {
    @State private var store = AppStore()
    @State private var showSettings = false
    
    var body: some View {
        HStack(spacing: 0) {
            // Left Sidebar
            SidebarView(store: store, showSettings: $showSettings)
            
            Divider()
            
            // Middle & Right Panels + Overlay container
            ZStack {
                if let selectedID = store.selectedRootNodeID {
                    HStack(spacing: 0) {
                        // Middle Panel: Active Chat
                        ChatView(nodeID: selectedID, store: store)
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                        
                        Divider()
                        
                        // Right Panel: Child Concept Card List
                        ChildNodesListView(parentID: selectedID, store: store)
                            .frame(maxHeight: .infinity)
                    }
                } else {
                    // Placeholder when no conversation is active
                    VStack(spacing: 12) {
                        Image(systemName: "square.stack.3d.up")
                            .font(.system(size: 48))
                            .foregroundStyle(.blue.gradient)
                        Text("Welcome to ConceptNest")
                            .font(.title2)
                            .fontWeight(.bold)
                        Text("Select a study topic from the sidebar or start a new one to begin learning.")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 40)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
                
                // Stack of Modals (Overlay on top of middle and right panels)
                if !store.modalStack.isEmpty {
                    // Semitransparent backdrop dim
                    Color.black.opacity(0.15)
                        .ignoresSafeArea()
                        .onTapGesture {
                            // Optionally allow tapping background to pop last modal
                            _ = store.modalStack.popLast()
                        }
                    
                    // Recursive Modal view scaling up into view
                    NestedModalView(store: store)
                        .padding(24) // Padding around the container to make it float
                        .transition(.asymmetric(
                            insertion: .scale(scale: 0.95).combined(with: .opacity),
                            removal: .scale(scale: 0.95).combined(with: .opacity)
                        ))
                }
            }
        }
        .frame(minWidth: 950, minHeight: 600)
        .sheet(isPresented: $showSettings) {
            SettingsView(store: store)
        }
        .onAppear {
            // Alert user if API key is missing
            if store.apiKey.isEmpty {
                showSettings = true
            }
        }
    }
}
