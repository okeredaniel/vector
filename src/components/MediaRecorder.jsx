import { useState, useRef } from "react";
import { Mic, Square } from "lucide-react";

export default function VoiceInput({ onTranscript }) {
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];

    recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");

      const res = await fetch("http://localhost:8000/voice/transcribe", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      onTranscript(data.text);
      stream.getTracks().forEach((t) => t.stop());
    };

    recorder.start();
    mediaRecorderRef.current = recorder;
    setRecording(true);
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  return (
    <button onClick={recording ? stopRecording : startRecording}>
      {recording ? <Square /> : <Mic />}
    </button>
  );
}