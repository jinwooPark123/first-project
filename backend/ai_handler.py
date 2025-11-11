import threading
from queue import Queue
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.callbacks import BaseCallbackHandler

"""
문맥필 / 글잇다 v2.3
AI는 대신 쓰지 않는다. 사람의 사고를 확장시킨다.
"""

# -----------------------------------------------------------
# 1️⃣ 다중 문장 제안 + 삽입 위치 설명 (일괄 응답)
# -----------------------------------------------------------
def generate_suggestions(user_input: str, tone: str = "자동 감지"):
    """비스트리밍 방식 문장 제안"""
    result_container = {"content": None, "error": None}

    def run_invoke():
        try:
            llm = ChatOpenAI(model_name="gpt-4o-mini", temperature=0.7)
            prompt = ChatPromptTemplate.from_template("""
당신은 글을 대신 쓰는 작가가 아닙니다.
당신의 역할은 사용자의 문체와 논리를 분석하여 자연스럽게 이어질 문장을 제안하는 것입니다.

요구사항:
- 2~3개의 제안 문장을 제공합니다.
- 각 문장마다 '어디에 넣으면 자연스러운지' 간단히 설명하세요.
- tone이 '자동 감지'이면 문체를 스스로 판단하세요.

현재 문체 모드: {tone}

입력 문장:
{input_text}
""")
            formatted = prompt.format_messages(input_text=user_input, tone=tone)
            response = llm.invoke(formatted)
            result_container["content"] = response.content.strip()
        except Exception as e:
            result_container["error"] = str(e)

    thread = threading.Thread(target=run_invoke)
    thread.start()
    thread.join(timeout=20)

    if result_container["error"]:
        return f"[ERROR] 문장 제안 실패: {result_container['error']}"
    elif result_container["content"]:
        return result_container["content"]
    else:
        return "[ERROR] 문장 제안 응답 없음 또는 시간 초과"


# -----------------------------------------------------------
# 2️⃣ 사고 유도형 질문 (일괄 응답)
# -----------------------------------------------------------
def generate_questions(user_input: str, tone: str = "자동 감지"):
    """사고를 확장하는 질문 제시"""
    result_container = {"content": None, "error": None}

    def run_invoke():
        try:
            llm = ChatOpenAI(model_name="gpt-4o-mini", temperature=0.7)
            prompt = ChatPromptTemplate.from_template("""
당신은 글쓰기 코치입니다.
입력된 문장을 분석하고, 사용자가 스스로 사고를 발전시킬 수 있도록 질문을 제시하세요.

현재 문체 모드: {tone}

입력 문장:
{input_text}
""")
            formatted = prompt.format_messages(input_text=user_input, tone=tone)
            response = llm.invoke(formatted)
            result_container["content"] = response.content.strip()
        except Exception as e:
            result_container["error"] = str(e)

    thread = threading.Thread(target=run_invoke)
    thread.start()
    thread.join(timeout=20)

    if result_container["error"]:
        return f"[ERROR] 사고 유도 질문 실패: {result_container['error']}"
    elif result_container["content"]:
        return result_container["content"]
    else:
        return "[ERROR] 사고 유도 질문 응답 없음 또는 시간 초과"


# -----------------------------------------------------------
# 3️⃣ 문체 교정 (일괄 응답)
# -----------------------------------------------------------
def generate_corrections(user_input: str, tone: str = "자동 감지"):
    """문체 교정 및 표현 개선"""
    result_container = {"content": None, "error": None}

    def run_invoke():
        try:
            llm = ChatOpenAI(model_name="gpt-4o-mini", temperature=0.6)
            prompt = ChatPromptTemplate.from_template("""
당신은 글의 논리적 흐름과 문체를 점검하는 편집자입니다.
문장의 의미는 유지하되, 표현을 조금 더 명료하게 다듬는 제안을 하세요.

현재 문체 모드: {tone}

입력 문장:
{input_text}
""")
            formatted = prompt.format_messages(input_text=user_input, tone=tone)
            response = llm.invoke(formatted)
            result_container["content"] = response.content.strip()
        except Exception as e:
            result_container["error"] = str(e)

    thread = threading.Thread(target=run_invoke)
    thread.start()
    thread.join(timeout=20)

    if result_container["error"]:
        return f"[ERROR] 문체 교정 실패: {result_container['error']}"
    elif result_container["content"]:
        return result_container["content"]
    else:
        return "[ERROR] 문체 교정 응답 없음 또는 시간 초과"


# -----------------------------------------------------------
# 4️⃣ 실시간 예측 (AI Cursor) — ✅ 중복 토큰 버그 수정됨
# -----------------------------------------------------------
def stream_predict_text(user_input: str, tone: str = "자동 감지"):
    """현재 입력 중인 문장을 실시간으로 이어서 예측"""

    class StreamHandler(BaseCallbackHandler):
        def __init__(self, queue: Queue):
            self.queue = queue
        def on_llm_new_token(self, token: str, **kwargs):
            # 토큰을 실시간으로 전송 (중복 제거)
            self.queue.put(token)
        def on_llm_end(self, *args, **kwargs):
            self.queue.put("[DONE]")
        def on_llm_error(self, error: Exception, **kwargs):
            self.queue.put(f"[ERROR]: {str(error)}")
            self.queue.put("[DONE]")

    q = Queue()
    handler = StreamHandler(q)
    llm = ChatOpenAI(
        model_name="gpt-4o-mini",
        temperature=0.6,
        streaming=True,
        callbacks=[handler],
    )

    prompt = ChatPromptTemplate.from_template("""
당신은 글을 대신 쓰지 않습니다.
현재 사용자가 작성 중인 문맥을 바탕으로, 다음에 자연스럽게 이어질 문장 조각을 예측하세요.

현재 문체 모드: {tone}
입력 문장:
{input_text}

요청:
- 완성형 문장이 아니라 자연스럽게 이어지는 조각으로 제안
- tone을 유지하고 문맥을 끊지 말 것
""")
    formatted = prompt.format_messages(input_text=user_input, tone=tone)

    def run_model():
        try:
            # ✅ BaseCallbackHandler가 이미 토큰 전송 처리 → 루프는 단순 실행만
            for _ in llm.stream(formatted):
                pass
            q.put("[DONE]")
        except Exception as e:
            q.put(f"[ERROR]: {str(e)}")
            q.put("[DONE]")

    threading.Thread(target=run_model, daemon=True).start()

    while True:
        token = q.get()
        if token == "[DONE]":
            break
        yield token


# -----------------------------------------------------------
# 5️⃣ 실시간 문장 제안 (SSE)
# -----------------------------------------------------------
def stream_generate_suggestions(user_input: str, tone: str = "자동 감지"):
    """문체 분석 기반 실시간 문장 제안"""
    class StreamHandler(BaseCallbackHandler):
        def __init__(self, queue: Queue):
            self.queue = queue
        def on_llm_new_token(self, token: str, **kwargs):
            self.queue.put(token)
        def on_llm_end(self, *args, **kwargs):
            self.queue.put("[DONE]")
        def on_llm_error(self, error: Exception, **kwargs):
            self.queue.put(f"[ERROR]: {str(error)}")
            self.queue.put("[DONE]")

    q = Queue()
    handler = StreamHandler(q)
    llm = ChatOpenAI(
        model_name="gpt-4o-mini",
        temperature=0.7,
        streaming=True,
        callbacks=[handler],
    )

    prompt = ChatPromptTemplate.from_template("""
당신은 글을 대신 쓰는 작가가 아닙니다.
사용자의 문체와 논리를 분석하여 자연스럽게 이어질 문장을 제안하세요.

요구사항:
- 2~3개의 제안 문장을 제공합니다.
- tone이 '자동 감지'이면 문체를 스스로 판단하세요.

현재 문체 모드: {tone}
입력 문장:
{input_text}
""")
    formatted = prompt.format_messages(input_text=user_input, tone=tone)

    def run_model():
        try:
            for _ in llm.stream(formatted):
                pass
            q.put("[DONE]")
        except Exception as e:
            q.put(f"[ERROR]: {str(e)}")
            q.put("[DONE]")

    threading.Thread(target=run_model, daemon=True).start()

    while True:
        token = q.get()
        if token == "[DONE]":
            break
        yield token


# -----------------------------------------------------------
# 6️⃣ 문장 제안 (스트리밍형)
# -----------------------------------------------------------
def generate_suggestions_streamed(user_input: str, tone: str = "자동 감지"):
    """일괄 문장 제안을 토큰 단위로 스트리밍"""
    class StreamHandler(BaseCallbackHandler):
        def __init__(self, queue: Queue):
            self.queue = queue
        def on_llm_new_token(self, token: str, **kwargs):
            self.queue.put(token)
        def on_llm_end(self, *args, **kwargs):
            self.queue.put("[DONE]")
        def on_llm_error(self, error: Exception, **kwargs):
            self.queue.put(f"[ERROR]: {str(error)}")
            self.queue.put("[DONE]")

    q = Queue()
    handler = StreamHandler(q)
    llm = ChatOpenAI(
        model_name="gpt-4o-mini",
        temperature=0.65,
        streaming=True,
        callbacks=[handler],
    )

    prompt = ChatPromptTemplate.from_template("""
당신은 글쓰기 코치이자 문장 제안 전문가입니다.
입력된 문장을 분석하고, 그 문장을 보완하거나 확장할 수 있는 문장을 제안하세요.

요구사항:
- 2~3개의 문장을 생성합니다.
- 각 문장은 한 줄마다 구분되게 하세요.
- tone이 '자동 감지'이면 문체를 스스로 판단하세요.

현재 문체 모드: {tone}
입력 문장:
{input_text}
""")
    formatted = prompt.format_messages(input_text=user_input, tone=tone)

    def run_model():
        try:
            for _ in llm.stream(formatted):
                pass
            q.put("[DONE]")
        except Exception as e:
            q.put(f"[ERROR]: {str(e)}")
            q.put("[DONE]")

    threading.Thread(target=run_model, daemon=True).start()

    while True:
        token = q.get()
        if token == "[DONE]":
            break
        yield token
