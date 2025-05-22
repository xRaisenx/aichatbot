import os
import json
import streamlit as st
import google.generativeai as genai
from dotenv import load_dotenv
import re
from retry import retry

# Load environment variables
load_dotenv()

# Streamlit UI Configuration
st.set_page_config(page_title="AI Debugger for Next.js & Streamlit", layout="wide")

# Configure Gemini API
api_key = os.getenv("GEMINI_API_KEY")
gemini_configured = False
model = None
api_config_status_message = None

if not api_key:
    api_config_status_message = "⚠️ GEMINI_API_KEY not found. 'Send to Gemini' button will not work."
else:
    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-2.0-flash")
        gemini_configured = True
        api_config_status_message = "✅ Gemini API configured successfully."
    except Exception as e:
        api_config_status_message = f"⚠️ Failed to configure Gemini: {e}"
        model = None

# UI Setup
st.title("🔧 AI Debugger for Next.js & Streamlit")
if api_config_status_message:
    if api_config_status_message.startswith("✅"):
        st.success(api_config_status_message)
    else:
        st.warning(api_config_status_message)

with st.expander("📌 How to Use This Tool"):
    st.markdown("""
1. Paste error logs (TypeScript, Next.js, React, Streamlit, or console output) in the first textarea.
2. (Optional) Add instructions or context (e.g., Next.js setup, Upstash usage) in the second textarea.
3. Click 'Generate AI Prompt' to analyze errors and create a debugging prompt.
4. View suggested fixes and optionally send the prompt to Gemini.
5. Use 'Clear' to reset.
""")

# Initialize session state
if 'prompt_generated' not in st.session_state:
    st.session_state.prompt_generated = False
if 'formatted_logs_md' not in st.session_state:
    st.session_state.formatted_logs_md = ""
if 'generated_prompt' not in st.session_state:
    st.session_state.generated_prompt = ""
if 'gemini_response' not in st.session_state:
    st.session_state.gemini_response = None
if 'raw_input' not in st.session_state:
    st.session_state.raw_input = ""
if 'additional_instructions' not in st.session_state:
    st.session_state.additional_instructions = ""
if 'extracted_files' not in st.session_state:
    st.session_state.extracted_files = []
if 'extracted_errors' not in st.session_state:
    st.session_state.extracted_errors = []
if 'extracted_logs_count' not in st.session_state:
    st.session_state.extracted_logs_count = 0

# Input sections
st.markdown("### 📋 Paste Error Logs")
st.session_state.raw_input = st.text_area(
    "Paste error logs here:",
    value=st.session_state.raw_input,
    height=300,
    placeholder='Paste TypeScript, Next.js, React, Streamlit, or console error logs (e.g., JSON or traceback).',
    key="raw_input_area",
    help="Enter error logs from TypeScript, Next.js, React, Streamlit, or console output. JSON logs should include 'resource', 'code', and 'message' fields."
)

st.markdown("### ✨ Additional Instructions or Context (Optional)")
st.session_state.additional_instructions = st.text_area(
    "Provide context or instructions for the AI:",
    value=st.session_state.additional_instructions,
    height=150,
    placeholder='E.g., "Fix errors in a Next.js app using Upstash Redis."',
    key="additional_instructions_area",
    help="Include details about your project (e.g., Next.js, React, Upstash) or specific fix instructions."
)

# Parse logs
def format_logs(raw_input):
    if not raw_input.strip():
        return "", []
    
    extracted_logs = []
    log_blocks = re.split(r'\n\s*\n', raw_input.strip())
    for block in log_blocks:
        block = block.strip()
        if not block:
            continue
        try:
            # Parse JSON logs (TypeScript/Next.js)
            parsed = json.loads(block)
            if isinstance(parsed, list):
                extracted_logs.extend([log for log in parsed if isinstance(log, dict) and all(k in log for k in ['code', 'message', 'resource'])])
            elif isinstance(parsed, dict) and all(k in parsed for k in ['code', 'message', 'resource']):
                extracted_logs.append(parsed)
        except json.JSONDecodeError:
            # Parse console logs (Streamlit/Python)
            lines = block.splitlines()
            error_info = {}
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                file_match = re.search(r'File "([^"]+)", line (\d+)', line)
                if file_match:
                    error_info['file'] = file_match.group(1).split('/')[-1]
                    error_info['line'] = file_match.group(2)
                error_match = re.search(r'(\w+Error): (.+)', line)
                if error_match:
                    error_info['code'] = error_match.group(1)
                    error_info['message'] = error_match.group(2)
                code_match = re.search(r'^\s*(.+)$', line)
                if code_match and 'code' in error_info and line not in lines[:lines.index(line)]:
                    error_info['snippet'] = code_match.group(1)
            if error_info.get('file') and error_info.get('code'):
                extracted_logs.append(error_info)
    
    if not extracted_logs and raw_input.strip():
        st.info("ℹ️ No valid error logs found. Ensure logs include file, error type, and message.")
        return "", []
    
    formatted_json = json.dumps(extracted_logs, indent=2)
    formatted_logs_md = f"""```json\n{formatted_json}\n```"""
    return formatted_logs_md, extracted_logs

# Extract files and error details
def extract_info_from_logs(logs):
    files = set()
    errors = []
    module_pattern = re.compile(r"Cannot find module '([^']+)'")
    identifier_pattern = re.compile(r"Cannot find name '([^']+)'|`([^`]+)`")
    async_pattern = re.compile(r"'await' expressions are only allowed")

    for log in logs:
        file_name = log.get('file') or log.get('resource', '').split('/')[-1]
        if file_name:
            files.add(file_name)
        
        error_info = {
            'file': file_name,
            'code': log.get('code', ''),
            'message': log.get('message', ''),
            'line': log.get('startLineNumber') or log.get('line', ''),
            'snippet': log.get('snippet', ''),
            'related': log.get('relatedInformation', []),
            'module_path': None,
            'identifier': None,
            'async_issue': False
        }
        
        # Extract module paths
        module_match = module_pattern.search(log.get('message', ''))
        if module_match:
            error_info['module_path'] = module_match.group(1)
        
        # Extract identifiers
        identifier_match = identifier_pattern.search(log.get('message', ''))
        if identifier_match:
            error_info['identifier'] = identifier_match.group(1) or identifier_match.group(2)
        
        # Detect async issues
        if async_pattern.search(log.get('message', '')):
            error_info['async_issue'] = True
        
        errors.append(error_info)
    
    return sorted(list(files)), errors

# Generate AI prompt
def generate_prompt(formatted_logs_md, files, errors, additional_instructions):
    files_str = ", ".join(files) if files else "the provided files"
    
    prompt_parts = [
        f"You are an expert developer for Next.js, React, and TypeScript. Analyze the provided error logs and instructions to identify and fix issues in {files_str}, a Next.js project potentially using Upstash Redis/Vector with .env configuration.",
        "For each error, follow these steps:\n",
        f"1. **Analyze Error**: Determine the root cause based on the error code, message, line number, and snippet (if available) in {files_str}. Consider Next.js-specific issues (e.g., module imports, path aliases, API routes, TypeScript configuration).",
        "2. **Plan Fix**: Outline a solution compatible with Next.js and TypeScript. Check for:\n"
        "- Missing files or incorrect import paths.\n"
        "- `tsconfig.json` misconfigurations (e.g., `baseUrl`, `paths`).\n"
        "- Missing dependencies or exports.\n"
        "- Avoid hardcoding specific implementations; propose flexible solutions.",
        "3. **Code Changes**: Provide TypeScript code snippets (```typescript) to fix the error. Include:\n"
        "- File creation with minimal, context-appropriate code.\n"
        "- Correct import statements or path adjustments.\n"
        "- Dependency installations if applicable.\n"
        "- Suggestions for `tsconfig.json` updates if relevant.",
        f"4. **Verify Changes**: Explain how the fix resolves the error and ensures compatibility with {files_str}. Address impacts on Next.js API routes, React components, or Upstash integration. State assumptions if context is missing.",
        f"5. **Placement**: Specify where to apply changes in {files_str}, new files, or `tsconfig.json`. Provide commands to verify fixes (e.g., `tsc`, `next build`)."
    ]
    
    if formatted_logs_md:
        prompt_parts.append("\n### Error Logs\n")
        prompt_parts.append(formatted_logs_md)
    
    if additional_instructions:
        prompt_parts.append("\n### Instructions\n")
        prompt_parts.append(f"```\n{additional_instructions.strip()}\n```\n")
    
    return "".join(prompt_parts)

# Retry-enabled Gemini API call
@retry(tries=3, delay=2, backoff=2)
def call_gemini(model, prompt):
    response = model.generate_content(prompt)
    if not hasattr(response, 'text') or not response.text:
        raise ValueError(f"No valid response text. Prompt feedback: {getattr(response, 'prompt_feedback', 'N/A')}")
    return response.text

# Generate AI Prompt button
if st.button("Generate AI Prompt"):
    if not st.session_state.raw_input.strip() and not st.session_state.additional_instructions.strip():
        st.error("❌ Please provide error logs or instructions.")
    else:
        try:
            formatted_logs_md, parsed_logs = format_logs(st.session_state.raw_input)
            st.session_state.extracted_logs_count = len(parsed_logs)
            files, errors = extract_info_from_logs(parsed_logs)
            st.session_state.extracted_files = files
            st.session_state.extracted_errors = errors
            
            prompt = generate_prompt(
                formatted_logs_md,
                files,
                errors,
                st.session_state.additional_instructions
            )
            
            st.session_state.formatted_logs_md = formatted_logs_md
            st.session_state.generated_prompt = prompt
            st.session_state.prompt_generated = True
            st.session_state.gemini_response = None
            st.rerun()
        except Exception as e:
            st.error(f"❌ Error during prompt generation: {e}")

# Display results
if st.session_state.prompt_generated:
    st.markdown("### 🔍 Extracted Information")
    st.write(f"**Found {st.session_state.extracted_logs_count} relevant log(s).**")
    st.write(f"**Files Involved:** {', '.join(st.session_state.extracted_files) if st.session_state.extracted_files else 'None found'}")
    
    if st.session_state.extracted_errors:
        st.markdown("**Errors Identified:**")
        for error in st.session_state.extracted_errors:
            st.markdown(f"- **{error['file']} (Line {error['line']})**: {error['message']} (Code: {error['code']})")
            if error.get('snippet'):
                st.markdown(f"  - Code Snippet: `{error['snippet']}`")
            if error.get('module_path'):
                st.markdown(f"  - Missing Module: `{error['module_path']}`")
            if error.get('identifier'):
                st.markdown(f"  - Undefined Identifier: `{error['identifier']}`")
            if error.get('async_issue'):
                st.markdown(f"  - Async Issue: Likely missing `async` keyword.")
            if error.get('related'):
                st.markdown("  - Related Information:")
                for rel in error['related']:
                    st.markdown(f"    - Line {rel['startLineNumber']}: {rel['message']}")
    
    if st.session_state.formatted_logs_md:
        st.markdown("### 📄 Extracted Logs")
        st.markdown(st.session_state.formatted_logs_md, unsafe_allow_html=True)
    
    st.markdown("### 🤖 Generated Prompt")
    st.text_area(
        "Generated prompt for AI debugging:",
        value=st.session_state.generated_prompt,
        height=300,
        key="prompt_area_display",
        help="This prompt is tailored to fix the errors in the provided logs."
    )

    # Dynamic fix suggestion
    if st.session_state.extracted_files and st.session_state.extracted_errors:
        st.markdown("### 🛠️ Suggested Fixes")
        for error in st.session_state.extracted_errors:
            file = error['file']
            code = error['code']
            line = error['line']
            message = error['message']
            module_path = error.get('module_path')
            
            if code in ["2448", "2454", "18048"] and file == "llm.ts":
                st.markdown(f"""
#### Fixing Variable Usage Issues in '{file}' (Line {line})
**Error**: {message} (Code: {code})

**Analysis**:
- **Code 2448/2454**: The variable `fields` is used before its declaration or assignment in `llm.ts` (lines 173, 174, 177).
- **Code 18048**: Accessing `fields.search_keywords` may result in `undefined` (line 174).
- This suggests `fields` is declared (possibly with `let`) after its usage or not initialized, and `search_keywords` is optional or unassigned.

**Fix Options**:
1. **Declare and Initialize `fields` Early**:
   - Define `fields` with a type and initial value at the start of the function.
   - Use an interface to specify `search_keywords` as optional.

   ```typescript
   // In lib/llm.ts, at the top of the file
   interface Fields {{
     search_keywords?: string;
     [key: string]: any; // Adjust based on actual structure
   }}

   // In the function containing lines 173-177
   async function someFunction() {{
     let fields: Fields = {{}}; // Initialize early

     // Existing code around lines 173-177
     fields = await someAsyncOperation(); // Example assignment
     const keywords = fields.search_keywords?.toUpperCase() ?? "default_keywords";
     console.log("Keywords:", keywords);

     // ... rest of the function ...
   }}
   ```

2. **Use Optional Chaining for `search_keywords`**:
   - Prevent runtime errors by safely accessing `search_keywords`.

   ```typescript
   // In lib/llm.ts, line 174
   const keywords = fields.search_keywords?.toUpperCase() ?? "default_keywords";
   ```

3. **Check Assignment Logic**:
   - Ensure `fields` is assigned before use (e.g., from an async operation like Upstash query).

   ```typescript
   // In lib/llm.ts, before line 173
   if (!fields) {{
     fields = {{}}; // Fallback if async operation fails
   }}
   ```

**Verification Steps**:
- Run `tsc` to confirm TypeScript errors are resolved.
- Run `next build` to ensure Next.js builds successfully.
- Test the function in `llm.ts` with cases where `fields` is assigned and unassigned.
- If using Upstash, verify `.env` variables (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) are set.

**Placement**:
- Add the `Fields` interface at the top of `lib/llm.ts`.
- Initialize `fields` at the start of the function containing lines 173-177.
- Replace `fields.search_keywords` access on line 174 with optional chaining.

**Note**: Share the code snippet around lines 173-189 in `llm.ts` and `tsconfig.json` to refine the fix. Confirm if `fields` is populated from Upstash or another source.
""")
            
            elif code == "2307" and module_path:
                module_name = module_path.split('/')[-1]
                st.markdown(f"""
#### Fixing Missing Module in '{file}' (Line {line})
**Error**: {message}

**Analysis**: The module `{module_path}` is either missing, has an incorrect path, or is misconfigured in the project.

**Fix Options**:
1. **Create the Module**:
   - Create `{module_name}.ts` in the `utils` directory (verify path: `../../utils` from `app/api/chat`).
   - Add minimal exports to resolve the error.

   ```typescript
   // File: utils/{module_name}.ts
   export function {module_name}Function() {{
     // Implement functionality based on project needs
     return null;
   }}
   ```

2. **Update Import in `{file}`**:
   - Ensure the import path matches the file location.

   ```typescript
   // In {file}, line {line}
   import {{ {module_name}Function }} from '{module_path}';
   ```

3. **Check `tsconfig.json`**:
   - Verify `baseUrl` and `paths` for path aliases.
   - Example:

   ```json
   // tsconfig.json
   {{
     "compilerOptions": {{
       "baseUrl": "src",
       "paths": {{
         "@utils/*": ["utils/*"]
       }}
     }}
   }}
   ```

   - Update import if using aliases:

   ```typescript
   // In {file}, line {line}
   import {{ {module_name}Function }} from '@utils/{module_name}';
   ```

4. **Verify Dependencies**:
   - If `{module_name}` is an external package, install it:
     ```bash
     npm install {module_name}
     ```
   - Update import if needed:

   ```typescript
   // In {file}, line {line}
   import {{ someExport }} from '{module_name}';
   ```

**Verification Steps**:
- Check if `utils/{module_name}.ts` exists in the project structure.
- Run `tsc` to verify TypeScript compilation.
- Run `next build` to ensure Next.js compatibility.
- If using Upstash, ensure `.env` variables (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) are set.

**Note**: Share the code around line {line} in `{file}` and the `utils` directory structure to tailor the fix. If `{module_name}` is for caching, confirm its intended functionality.
""")
            
            elif code == "2304" and error.get('identifier'):
                identifier = error['identifier']
                st.markdown(f"""
#### Fixing Undefined Identifier in '{file}' (Line {line})
**Error**: {message}

**Analysis**: The identifier `{identifier}` is not defined in `{file}`.

**Fix Options**:
1. **Declare the Identifier**:
   - Add a declaration in `{file}` before line {line}.

   ```typescript
   // In {file}, before line {line}
   const {identifier} = null; // Adjust type/value based on context
   ```

2. **Import the Identifier**:
   - If `{identifier}` is from another module, import it.

   ```typescript
   // In {file}, at the top
   import {{ {identifier} }} from 'some-module';
   ```

3. **Check Scope**:
   - Ensure `{identifier}` is in scope or defined in a parent scope.

**Verification Steps**:
- Run `tsc` to check TypeScript compilation.
- Verify `{identifier}` usage in `{file}`.

**Note**: Share the code snippet around line {line} to confirm `{identifier}`’s purpose.
""")
            
            elif code == "1308" and error.get('async_issue'):
                st.markdown(f"""
#### Fixing Async Issue in '{file}' (Line {line})
**Error**: {message}

**Analysis**: An `await` expression is used outside an `async` function in `{file}`.

**Fix Options**:
1. **Add `async` Keyword**:
   - Modify the enclosing function to be `async`.

   ```typescript
   // In {file}, around the function containing line {line}
   async function enclosingFunction(/* parameters */) {{
     // Existing code
     const result = await someOperation();
     return result;
   }}
   ```

2. **Remove `await`**:
   - If `await` is unnecessary, remove it and handle the promise differently.

   ```typescript
   // In {file}, line {line}
   someOperation().then(result => {{ /* handle result */ }});
   ```

**Verification Steps**:
- Run `tsc` to verify compilation.
- Test the function to ensure async behavior is correct.

**Note**: Share the function code around line {line} for a precise fix.
""")
            
            else:
                st.markdown(f"""
#### Fixing Error in '{file}' (Line {line})
**Error**: {message}

**Analysis**: Error code `{code}` detected in `{file}`.

**Fix Options**:
1. **Review Code**:
   - Check syntax, imports, or configurations at line {line}.
2. **Run Diagnostics**:
   - Use `tsc` or `next build` to identify related issues.

**Verification Steps**:
- Run `tsc` and `next build` to test fixes.
- Check `tsconfig.json` for `moduleResolution` or `paths` issues.

**Note**: Share the code snippet around line {line} and `tsconfig.json` for a tailored fix.
""")

# Send to Gemini button
if gemini_configured and model and st.session_state.prompt_generated:
    if st.button("Send to Gemini"):
        with st.spinner("Sending to Gemini..."):
            try:
                if not st.session_state.generated_prompt.strip():
                    st.error("❌ The generated prompt is empty.")
                else:
                    st.info(f"DEBUG: Sending prompt (length: {len(st.session_state.generated_prompt)} characters)")
                    response = call_gemini(model, st.session_state.generated_prompt)
                    st.session_state.gemini_response = response
                    st.success("✅ Response received from Gemini")
                    st.rerun()
            except Exception as e:
                st.session_state.gemini_response = f"Error: Failed to get response from Gemini: {e}"
                st.error(f"❌ Failed to get response from Gemini: {e}")
                st.rerun()

# Display Gemini response
if st.session_state.gemini_response:
    st.markdown("### 🧠 Gemini Response")
    st.text_area(
        "Gemini Response:",
        value=st.session_state.gemini_response,
        height=300,
        key="gemini_response_area",
        help="Response from Gemini with debugging suggestions or error details."
    )

# Clear button
if st.button("Clear"):
    st.session_state.prompt_generated = False
    st.session_state.formatted_logs_md = ""
    st.session_state.generated_prompt = ""
    st.session_state.gemini_response = None
    st.session_state.raw_input = ""
    st.session_state.additional_instructions = ""
    st.session_state.extracted_files = []
    st.session_state.extracted_errors = []
    st.session_state.extracted_logs_count = 0
    st.rerun()