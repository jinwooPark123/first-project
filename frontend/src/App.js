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

  const handleStream = async () => {
    setStreamText("");
    try {
      const response = await fetch("http://localhost:5000/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input, tone: highlightMode }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const token = line.replace("data: ", "");
            if (token !== "[DONE]") {
              accumulated += token;
              setStreamText(accumulated);
            }
          }
        }
      }
    } catch (err) {
      console.error("Stream error:", err);
      setStreamText("연결 오류 발생");
    }
  };

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

  const handleHover = (type) => {
    const previews = {
      감성적: "따뜻하고 공감형 문체 예시",
      논리적: "논거와 분석 중심 문체 예시",
      설명적: "정보를 풀어주는 서술형 문체 예시",
      서사적: "이야기 흐름 중심 문체 예시",
    };
    setHoverPreview(previews[type]);
  };

  return (
    <div className="App">
      <h2>문맥필 / 글잇다 v2.2 — 사고 확장형 문맥 보조 시스템</h2>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="문장을 입력하세요..."
      />

      <div className="btn-group">
        <button onClick={handleStream}>실시간 예측</button>
        <button onClick={handleSuggest}>문장 제안</button>
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

        {suggestions && (
          <div className="ai-suggestions">
            <h3>추천 문장 💡</h3>
            <p>{suggestions}</p>
          </div>
        )}

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
