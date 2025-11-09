import threading
from queue import Queue
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.callbacks import BaseCallbackHandler

# 문맥필 / 글잇다 v2.2
# AI는 대신 쓰지 않는다. 사람의 사고를 확장시킨다.

def generate_suggestions(user_input: str, tone: str = "자동 감지"):
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
    result = llm.invoke(formatted)   # ✅ 수정됨
    return result.content


def generate_questions(user_input: str, tone: str = "자동 감지"):
    llm = ChatOpenAI(model_name="gpt-4o-mini", temperature=0.7)
    prompt = ChatPromptTemplate.from_template("""
당신은 글쓰기 코치입니다.
입력된 문장을 분석하고, 사용자가 스스로 사고를 발전시킬 수 있도록 질문을 제시하세요.

현재 문체 모드: {tone}

입력 문장:
{input_text}
""")
    formatted = prompt.format_messages(input_text=user_input, tone=tone)
    result = llm.invoke(formatted)   # ✅ 수정됨
    return result.content


def generate_corrections(user_input: str, tone: str = "자동 감지"):
    llm = ChatOpenAI(model_name="gpt-4o-mini", temperature=0.6)
    prompt = ChatPromptTemplate.from_template("""
당신은 글의 논리적 흐름과 문체를 점검하는 편집자입니다.
문장의 의미는 유지하되, 표현을 조금 더 명료하게 다듬는 제안을 하세요.

현재 문체 모드: {tone}

입력 문장:
{input_text}
""")
    formatted = prompt.format_messages(input_text=user_input, tone=tone)
    result = llm.invoke(formatted)   # ✅ 수정됨
    return result.content


def stream_predict_text(user_input: str, tone: str = "자동 감지"):
    class StreamHandler(BaseCallbackHandler):
        def __init__(self, queue: Queue):
            self.queue = queue

        def on_llm_new_token(self, token: str, **kwargs):
            self.queue.put(token)

        def on_llm_end(self, response, **kwargs):
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
""")
    formatted = prompt.format_messages(input_text=user_input, tone=tone)

    threading.Thread(target=lambda: llm.invoke(formatted)).start()  # ✅ 수정됨

    while True:
        token = q.get()
        if token == "[DONE]":
            break
        yield token
