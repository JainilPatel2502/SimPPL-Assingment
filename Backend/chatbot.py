import traceback
from pydantic import BaseModel
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, ToolMessage
from langchain_core.tools import tool

SYSTEM_PROMPT = """You are a data analyst assistant for a Reddit dataset about a high-profile legal investigation.
You have access to a pandas DataFrame `df`. When the user asks a data question, you MUST call the `query_dataset` tool with valid Python code.
CRITICAL: `query_dataset` is the ONLY tool that exists. There are NO other tools.
CRITICAL: You MUST assign your final output to a variable named exactly `result` (e.g. `result = df.head()`). Do NOT omit `result = `.
Use only `df`, `pd`, `np` — no other imports.
Study the "Dataset schema" provided at the end of this prompt carefully. It contains the exact column names, data types, and sample rows from the dataset. ONLY use the columns listed there.
Always be concise, explain results in nicely formatted Markdown, and provide the exact answer to the user's question.
Strictly suggest exactly 3 concise follow-up questions the user might want to ask. 
Format these suggestions strictly at the very end of your response inside a <suggestions>...</suggestions> XML block, with each suggestion on a new line starting with a bullet point (*)."""


def process_chat_message(
    message: str,
    history: list,
    api_key: str,
    schema_context: str,
    query_callback,
) -> dict:
    if not api_key:
        return {"answer": "OPENAI_API_KEY is not set.", "code": None, "raw_result": None}

    @tool
    def query_dataset(code: str) -> str:
        """Call this tool to execute Python/pandas code against the Reddit DataFrame `df`. 
        CRITICAL: The string you provide MUST explicitly contain 'result = ' followed by your pandas query. 
        Example: `result = df['subreddit'].value_counts()`. Do NOT omit `result = `.
        Globals available: df, pd, np, semantic_search."""
        return query_callback(code)

    llm = ChatOpenAI(
        model="gpt-4o-mini",
        api_key=api_key,
        temperature=0,
    )

    llm_with_tools = llm.bind_tools([query_dataset])

    # Build message history
    msgs = [SystemMessage(content=f"{SYSTEM_PROMPT}\n\nDataset schema:\n{schema_context}")]
    for msg in history:
        r = msg.get("role", "") if isinstance(msg, dict) else getattr(msg, "role", "")
        t = msg.get("text", "") if isinstance(msg, dict) else getattr(msg, "text", "")
        msgs.append(HumanMessage(content=t) if r == "user" else AIMessage(content=t))
    msgs.append(HumanMessage(content=message))

    generated_code, raw_result = None, None

    try:
        print("[DEBUG chatbot.py] Invoking OpenAI tool LLM...")
        response = llm_with_tools.invoke(msgs)
        
        print(f"[DEBUG chatbot.py] Response tool calls: {response.tool_calls}")

        if response.tool_calls:
            tool_call = response.tool_calls[0]
            generated_code = tool_call["args"].get("code", "")
            print(f"[DEBUG chatbot.py] Raw generated code arg: {generated_code}")
            
            raw_result = query_callback(generated_code)
            print(f"[DEBUG chatbot.py] raw_result from execution: {raw_result}")

            msgs.extend([
                response,
                ToolMessage(content=str(raw_result), tool_call_id=tool_call["id"], name=tool_call["name"])
            ])
            
            answer = llm_with_tools.invoke(msgs).content
            print(f"[DEBUG chatbot.py] Final LLM Answer: {answer}")
            
        elif hasattr(response, "invalid_tool_calls") and response.invalid_tool_calls:
            print(f"[DEBUG chatbot.py] Invalid tool calls generated: {response.invalid_tool_calls}")
            answer = llm.invoke(msgs).content  # Retry without tools
        else:
            print(f"[DEBUG chatbot.py] LLM replied without calling tools.")
            answer = response.content

        return {"answer": str(answer), "code": generated_code, "raw_result": raw_result}

    except Exception as exc:
        print(f"Chat error: {exc}")
        return {"answer": f"Error: {exc}", "code": generated_code, "raw_result": traceback.format_exc(limit=3)}


