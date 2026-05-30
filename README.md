# ConceptNest 🪹

ConceptNest is an interactive, web-based learning workspace designed to help you study and unpack complex terms and concepts dynamically without losing your reading context. It helps you branch out topics, test your understanding using active recall, and master ideas using the Feynman Technique.

## 🚀 Key Features

* **Recursive Nested Workspaces (Modals Stack)**: Select a term inside any chat message or click a preset concept to instantly spawn a private child workspace in a nested modal, allowing you to follow threads of inquiry without losing your spot.
* **Stable Selection Branching**: Simply highlight any word or phrase in a chat bubble to reveal the branch helper. You can instantly spawn a new topic card from your selection.
* **Feynman Active Recall Gate**: Test your understanding by going into exam mode ("Master Concept"). You will be prompted to explain the concept in your own words, and an AI evaluator checks your gaps and understanding strictly.
* **Context Feedback integration**: Once you master a nested concept card, its summary is automatically integrated back into the parent thread context, allowing the parent conversation to benefit from your learning!
* **Aesthetic Multi-panel Workspace**: Resizeable layout panels (Sidebar, Main Chat, Right Concept list) designed with a premium, sleek dark-mode aesthetic.

---

## 🛠️ Local Development

Ensure you have [Node.js](https://nodejs.org/) installed (version 18+ recommended).

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Run dev server**:
   ```bash
   npm run dev
   ```
   Open your browser to `http://localhost:5173`.

3. **Build for production**:
   ```bash
   npm run build
   ```

---

## ⚙️ Configuration & LLM Setup

To start chatting, click the **Settings** gear icon in the bottom left of the sidebar:
1. Select your provider (**Anthropic** or **OpenAI**).
2. Enter your API Key.
3. Choose your model (e.g. `claude-3-5-sonnet-20241022` or `gpt-4o`).
4. (Optional) Customize the API Endpoint URL if using a proxy or custom deployment.

All settings and study progress are persisted locally in your browser's `localStorage`.

---

## 📦 Deployment to GitHub Pages

This repository is configured with a GitHub Actions workflow that automatically builds and deploys the site to GitHub Pages whenever you push changes to the `main` branch.

To enable GitHub Pages in your repository settings:
1. Go to your repository on GitHub.
2. Click on **Settings** -> **Pages** (in the sidebar).
3. Under **Build and deployment** -> **Source**, select **GitHub Actions**.
4. Push your code to the `main` branch; the action will run and host your site.
