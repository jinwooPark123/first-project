import threading
from queue import Queue
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.callbacks import BaseCallbackHandler

"""
문맥필 / 글잇다 v2.4
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
당신의 역할은 사용자가 현재 작성한 문장 조각에 이어 붙일 수 있는 등가적인 문장들을 제안하는 것입니다.

요구사항:
1. 등가적 문장 제안 (매우 중요):
   - 입력된 문장 조각의 마지막 부분을 분석하세요.
   - 그 조각에 자연스럽게 이어 붙일 수 있는 등가적인 문장들을 제안하세요.
   - 모든 제안 문장은 같은 위치에 들어갈 수 있는 대안이어야 합니다.
   - 문맥상 어울리지 않는 연결어(따라서, 그런데, 하지만 등)를 사용하지 마세요.
   - 예시: "성능에" → "성능에 따라 달라질 수 있습니다", "성능에 영향을 미칩니다", "성능에 비례합니다" (등가적)
   - 잘못된 예: "성능에 따라서~" (문맥상 어울리지 않음)

2. 문맥 인식 및 관련 구절 추천:
   - 유명한 문구, 시, 노래, 명언 등이 포함되어 있다면 그와 관련된 구절을 반드시 추천하세요.
   - 애국가 구절이 나오면 → 애국가의 다른 구절을 자연스럽게 제안
   - 특정 주제나 테마가 보이면 → 그 주제와 관련된 유명한 표현이나 구절 제안
   - 역사적 맥락이 있으면 → 관련된 역사적 표현이나 문구 제안
   - 시나 노래의 일부가 나오면 → 같은 작품의 다른 구절 제안

3. 출력 형식:
   - 2~3개의 등가적인 제안 문장을 제공합니다.
   - 각 문장 앞에 번호를 붙이세요 (1., 2., 3.).
   - 각 문장마다 '어디에 넣으면 자연스러운지' 간단히 설명하세요.

4. 문체 유지:
   - tone이 '자동 감지'이면 문체를 스스로 판단하세요.
   - 원문의 문체와 톤을 일관되게 유지하세요.

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
# 2️⃣ 오타·문법 탐지 및 수정 제안 (일괄 응답)
# -----------------------------------------------------------
def detect_errors(user_input: str, tone: str = "자동 감지"):
    """오타·문법 탐지 및 수정 제안"""
    result_container = {"content": None, "error": None}

    def run_invoke():
        try:
            llm = ChatOpenAI(model_name="gpt-4o-mini", temperature=0.5)
            prompt = ChatPromptTemplate.from_template("""
당신은 오타, 문법 오류, 문맥 오류를 탐지하고 수정 제안을 제공하는 전문가입니다.

요구사항:
1. 오타 탐지 (철저히):
   - 철자 오류를 정확히 탐지하세요.
   - 예시: "불벼함" → "불변함" (벼→변 오타)
   - 예시: "보존하세" → "보전하세" (존→전 오타, 문맥상 올바른 단어)
   - 자음/모음 오타, 비슷한 글자 혼동 등을 놓치지 마세요.

2. 맞춤법 및 문법 오류:
   - 띄어쓰기, 조사 사용, 어미 활용 등을 확인하세요.

3. 문맥 오류 (매우 중요):
   - 문맥에 맞지 않는 단어 사용을 반드시 탐지하세요.
   - 유명한 문구나 고정된 표현이 있다면 정확한 원문을 기준으로 판단하세요.
   - 예시: "대한사람 대한으로 길이 보존하세" → "보전하세"가 올바름 (국가의 공식 표현)
   - 예시: "바람서리 불벼함은" → "불변함은"이 올바름 (불변함 = 변하지 않음)
   - 원문의 의미와 문맥을 깊이 고려하여 올바른 단어를 제안하세요.

4. 탐지 방법 (중요):
   - 전체 문맥을 철저히 분석하세요.
   - 각 단어가 문맥상 적절한지, 원문의 의도와 맞는지 확인하세요.
   - 유명한 문구(국가, 시, 노래 등)는 정확한 원문을 기준으로 판단하세요.
   - 비슷한 발음이나 의미의 단어가 잘못 사용되었는지 확인하세요.
   - 오타가 있는지 철자 하나하나를 꼼꼼히 확인하세요.

5. 출력 형식:
   - 각 오류에 대해 원본 텍스트와 수정된 텍스트를 명확히 제시하세요.
   - 오류 유형을 정확히 분류하세요: "오타", "맞춤법", "문법", "문맥오류"
   - 오류 이유를 구체적으로 설명하세요 (예: "국가의 공식 표현에서 '보전하세'가 올바른 표현입니다")
   - 오류가 없다면 "오류가 발견되지 않았습니다."라고 표시하세요.
   - JSON 형식으로 반환: {{"errors": [{{"original": "원본 텍스트", "corrected": "수정된 텍스트", "type": "오타/맞춤법/문법/문맥오류", "reason": "구체적인 오류 이유"}}], "summary": "전체 요약"}}

주의사항:
- 작은 오타라도 놓치지 마세요.
- 문맥상 잘못된 단어 사용은 반드시 지적하세요.
- 유명한 문구의 경우 정확한 원문을 기준으로 판단하세요.

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
        return {"error": f"[ERROR] 오타·문법 탐지 실패: {result_container['error']}", "errors": []}
    elif result_container["content"]:
        # JSON 파싱 시도, 실패 시 원본 텍스트 반환
        try:
            import json
            # JSON 블록 추출 시도
            content = result_container["content"]
            if "{" in content and "}" in content:
                json_start = content.find("{")
                json_end = content.rfind("}") + 1
                json_str = content[json_start:json_end]
                parsed = json.loads(json_str)
                return parsed
            else:
                return {"error": None, "errors": [], "summary": content}
        except:
            return {"error": None, "errors": [], "summary": result_container["content"]}
    else:
        return {"error": "[ERROR] 오타·문법 탐지 응답 없음 또는 시간 초과", "errors": []}


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
사용자가 현재 입력 중인 문장을 완성하는 데 도움을 주는 역할입니다.

요구사항:
1. 완성된 문장 제안 (매우 중요):
   - 사용자가 입력 중인 문장 조각을 분석하세요.
   - 그 조각을 자연스럽게 완성할 수 있는 하나의 완성된 문장을 제안하세요.
   - 절대 번호(1., 2., 3. 등)를 붙이지 마세요.
   - 절대 여러 문장을 나열하지 마세요.
   - 하나의 완성된 문장만 제안하세요.
   - 문맥상 어울리지 않는 연결어를 사용하지 마세요.

2. 문맥 인식 및 관련 구절 추천:
   - 유명한 문구, 시, 노래, 명언 등이 포함되어 있다면 그와 관련된 구절을 반드시 추천하세요.
   - 애국가 구절이 나오면 → 애국가의 다른 구절을 자연스럽게 제안
   - 특정 주제나 테마가 보이면 → 그 주제와 관련된 유명한 표현이나 구절 제안
   - 역사적 맥락이 있으면 → 관련된 역사적 표현이나 문구 제안
   - 시나 노래의 일부가 나오면 → 같은 작품의 다른 구절 제안

3. 출력 형식 (엄격히 준수):
   - 번호(1., 2., 3. 등)를 절대 사용하지 마세요.
   - 하나의 완성된 문장만 출력하세요.
   - 불필요한 설명, 부가 설명, 줄바꿈 없이 문장만 제시하세요.
   - 여러 문장을 제안하지 마세요.

4. 문체 유지:
   - tone이 '자동 감지'이면 문체를 스스로 판단하세요.
   - 원문의 문체와 톤을 일관되게 유지하세요.

주의사항:
- 번호를 사용하면 안 됩니다.
- 여러 문장을 나열하면 안 됩니다.
- 하나의 완성된 문장만 제안하세요.

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
1. 문맥 인식 및 관련 구절 추천 (매우 중요):
   - 입력 문장의 문맥을 깊이 분석하세요.
   - 유명한 문구, 시, 노래, 명언 등이 포함되어 있다면 그와 관련된 구절을 반드시 추천하세요.
   
   구체적 예시:
   - 애국가 구절이 나오면 → 애국가의 다른 구절을 자연스럽게 제안
     * 예: "동해물과 백두산이 마르고 닳도록" → "무궁화 삼천리 화려강산", "남산 위에 저 소나무 철갑을 두른 듯" 등 애국가의 다른 구절 제안
     * 예: "대한사람 대한으로 길이 보전하세" → "가을 하늘 공활한데 높고 구름 없이", "이 기상과 이 맘으로 충성을 다하여" 등 제안
   - 특정 주제나 테마가 보이면 → 그 주제와 관련된 유명한 표현이나 구절 제안
   - 역사적 맥락이 있으면 → 관련된 역사적 표현이나 문구 제안
   - 시나 노래의 일부가 나오면 → 같은 작품의 다른 구절 제안
   
   중요: 유명한 문구를 인식했다면 반드시 그와 관련된 구절을 우선적으로 제안하세요.

2. 일반 문장 제안:
   - 문맥상 유명한 구절이 없다면, 입력된 문장을 보완하거나 확장할 수 있는 문장을 제안하세요.
   - 2~3개의 문장을 생성합니다.

3. 출력 형식:
   - 각 문장은 한 줄마다 구분되게 하세요.

4. 문체 유지:
   - tone이 '자동 감지'이면 문체를 스스로 판단하세요.
   - 원문의 문체와 톤을 일관되게 유지하세요.

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
