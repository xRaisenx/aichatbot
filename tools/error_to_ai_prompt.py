import streamlit as st
import json

st.set_page_config(page_title="TS Error → AI Prompt Generator", layout="wide")

st.title("🔧 TypeScript Error Logs → AI Prompt Generator")

st.markdown("Paste your TypeScript error logs below:")

# Input: Raw error log
raw_input = st.text_area("Paste raw error logs (JSON format):", height=300)

# Button to generate prompt
if st.button("Generate AI Prompt"):
    try:
        # Parse error logs
        logs = json.loads(raw_input)

        # Render formatted logs
        st.subheader("📄 Formatted Logs (Collapsible Markdown)")
        formatted_logs = f"""<details>\n<summary>Click to expand logs</summary>\n\n```json\n{json.dumps(logs, indent=2)}\n```\n\n</details>"""
        st.code(formatted_logs, language="markdown")

        # Generate prompt
        st.subheader("🤖 Copy-Ready AI Prompt")

        prompt_template = """
### Code Error Logs
{formatted_logs}

### AI Instruction / Prompt
Please analyze and fix these TypeScript errors from `llm.ts`. Ensure:
- No duplicate imports (e.g., 'pino').
- All missing types or values are properly imported or defined (e.g., `QueryMetadata`, `VectorResult`, `UpstashError`, `LLMStructuredResponse`).
- Any broken or missing dependencies are implemented, stubbed, or safely removed.
- All functions continue to work and nothing breaks.

If needed, suggest fixes or rewrites for unclear sections. Include updated import statements or type/interface definitions if missing.
""".strip()

        final_prompt = prompt_template.replace("{formatted_logs}", formatted_logs)
        st.text_area("AI Prompt (Ready to Copy)", value=final_prompt, height=500)

    except json.JSONDecodeError:
        st.error("❌ Invalid JSON format. Please check your error logs.")
