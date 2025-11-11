import React, { useState } from "react";
import "./App.css";

function App() {
  const [input, setInput] = useState("");
  const [streamText, setStreamText] = useState("");
  const [hoverPreview, setHoverPreview] = useState("");
  const [highlightMode, setHighlightMode] = useState("논리적");
  const [suggestions, setSuggestions] = useState("");
  const [questions, setQuestions] = useState("");
  const [corrections, setCorrections] = useState("");
  const [streamSuggestion, setStreamSuggestion] = useState("");
  const [streamedSuggestion, setStreamedSuggestion] = useState(""); // ✅ 새 상태 추가
  const [isSuggestStreaming, setIsSuggestStreaming] = useState(false);
  const [isStreamedSuggesting, setIsStreamedSuggesting] = useState(false); // ✅ 새 상태 추가

  // ============================================================
  // 1️⃣ 실시간 예측 (AI Cursor)
  // ============================================================
  const handleStream = async () => {
    if (window.currentEventSource) {
      window.currentEventSource.close();
      window.currentEventSource = null;
    }

    setStreamText("");

    try {
      await fetch("http://localhost:5000/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input, tone: highlightMode }),
      });

      const eventSource = new EventSource("http://localhost:5000/stream-events");

      eventSource.onmessage = (event) => {
        const data = event.data;
        if (data === "[DONE]") {
          eventSource.close();
          window.currentEventSource = null;
          return;
        }
        setStreamText((prev) => prev + data);
      };

      eventSource.onerror = (err) => {
        console.error("SSE error:", err);
        setStreamText((prev) => prev + "\n\n[스트리밍 오류]");
        eventSource.close();
        window.currentEventSource = null;
      };

      window.currentEventSource = eventSource;
    } catch (err) {
      console.error("Stream error:", err);
      setStreamText("연결 오류 발생: " + err.message);
    }
  };

  // ============================================================
  // 2️⃣ 문장 제안 + 사고유도 + 교정 (일괄 응답)
  // ============================================================
  const handleSuggest = async () => {
    try {
      const res = await fetch("http://localhost:5000/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input, tone: highlightMode }),
      });
      const data = await res.json();
      setSuggestions(data.suggestions || "");
      setQuestions(data.questions || "");
      setCorrections(data.corrections || "");
    } catch (err) {
      console.error("Suggest error:", err);
    }
  };

  // ============================================================
  // 3️⃣ 실시간 문장 제안 (SSE)
  // ============================================================
  const handleSuggestStream = async () => {
    if (window.currentEventSource) {
      window.currentEventSource.close();
      window.currentEventSource = null;
    }

    setStreamSuggestion("");
    setIsSuggestStreaming(true);

    try {
      await fetch("http://localhost:5000/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input, tone: highlightMode }),
      });

      const eventSource = new EventSource("http://localhost:5000/suggest-stream");

      eventSource.onmessage = (event) => {
        const data = event.data;
        if (data === "[DONE]") {
          setIsSuggestStreaming(false);
          eventSource.close();
          window.currentEventSource = null;
          return;
        }
        setStreamSuggestion((prev) => prev + data);
      };

      eventSource.onerror = (err) => {
        console.error("Suggest Stream SSE error:", err);
        setStreamSuggestion((prev) => prev + "\n\n[스트리밍 오류]");
        setIsSuggestStreaming(false);
        eventSource.close();
        window.currentEventSource = null;
      };

      window.currentEventSource = eventSource;
    } catch (err) {
      console.error("Suggest Stream error:", err);
      setStreamSuggestion("연결 오류 발생: " + err.message);
      setIsSuggestStreaming(false);
    }
  };

  // ============================================================
  // 4️⃣ 문장 제안 (스트리밍형, 새 기능)
  // ============================================================
  const handleSuggestStreamed = async () => {
    if (window.currentEventSource) {
      window.currentEventSource.close();
      window.currentEventSource = null;
    }

    setStreamedSuggestion("");
    setIsStreamedSuggesting(true);

    try {
      await fetch("http://localhost:5000/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input, tone: highlightMode }),
      });

      const eventSource = new EventSource("http://localhost:5000/suggest-streamed");

      eventSource.onmessage = (event) => {
        const data = event.data;
        if (data === "[DONE]") {
          setIsStreamedSuggesting(false);
          eventSource.close();
          window.currentEventSource = null;
          return;
        }
        setStreamedSuggestion((prev) => prev + data);
      };

      eventSource.onerror = (err) => {
        console.error("Suggest Streamed SSE error:", err);
        setStreamedSuggestion((prev) => prev + "\n\n[스트리밍 오류]");
        setIsStreamedSuggesting(false);
        eventSource.close();
        window.currentEventSource = null;
      };

      window.currentEventSource = eventSource;
    } catch (err) {
      console.error("Suggest Streamed error:", err);
      setStreamedSuggestion("연결 오류 발생: " + err.message);
      setIsStreamedSuggesting(false);
    }
  };

  // ============================================================
  // 5️⃣ Hover 미리보기
  // ============================================================
  const handleHover = (type) => {
    const previews = {
      감성적: "따뜻하고 공감형 문체 예시",
      논리적: "논거와 분석 중심 문체 예시",
      설명적: "정보를 풀어주는 서술형 문체 예시",
      서사적: "이야기 흐름 중심 문체 예시",
    };
    setHoverPreview(previews[type]);
  };

  // ============================================================
  // JSX 렌더링
  // ============================================================
  return (
    <div className="App">
      <h2>문맥필 / 글잇다 v2.3 — 사고 확장형 문맥 보조 시스템</h2>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="문장을 입력하세요..."
      />

      <div className="btn-group">
        <button onClick={handleStream}>실시간 예측 ✍️</button>
        <button onClick={handleSuggest}>문장 제안 💡(일괄)</button>
        <button onClick={handleSuggestStream}>실시간 제안 💡</button>
        <button onClick={handleSuggestStreamed}>문장 제안 💡(스트리밍)</button>
      </div>

      <div className="highlight-mode">
        <span>문체 모드:</span>
        {["감성적", "논리적", "설명적", "서사적"].map((mode) => (
          <button
            key={mode}
            className={highlightMode === mode ? "active" : ""}
            onMouseEnter={() => handleHover(mode)}
            onMouseLeave={() => setHoverPreview("")}
            onClick={() => setHighlightMode(mode)}
          >
            {mode}
          </button>
        ))}
      </div>

      {hoverPreview && <div className="hover-preview">{hoverPreview}</div>}

      <div className="output-section">
        <div className="ai-cursor">
          <h3>AI Cursor ✍️</h3>
          <p>{streamText}</p>
        </div>

        <div className="ai-suggestions">
          <h3>문장 제안 💡 (일괄)</h3>
          <p>{suggestions}</p>
        </div>

        <div className="ai-suggestions">
          <h3>실시간 제안 💡 (SSE)</h3>
          {isSuggestStreaming ? (
            <p className="loading">AI가 실시간 제안 중...</p>
          ) : (
            <p>{streamSuggestion}</p>
          )}
        </div>

        <div className="ai-suggestions">
          <h3>문장 제안 💡 (스트리밍)</h3>
          {isStreamedSuggesting ? (
            <p className="loading">AI가 스트리밍 제안 중...</p>
          ) : (
            <p>{streamedSuggestion}</p>
          )}
        </div>

        {questions && (
          <div className="ai-questions">
            <h3>사고 유도 질문 💭</h3>
            <p>{questions}</p>
          </div>
        )}

        {corrections && (
          <div className="ai-corrections">
            <h3>문체 교정 ✏️</h3>
            <p>{corrections}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
