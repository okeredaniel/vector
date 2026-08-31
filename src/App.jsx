import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ChatProvider } from "./context/ChatContext.jsx";
import Dashboard from "./components/Dashboard.jsx";
import BottomNav from "./components/BottomNav.jsx";
import ChatTab from "./pages/ChatTab.jsx";
import ActivityTab from "./pages/ActivityTab.jsx";
import AccountTab from "./pages/AccountTab.jsx";
import { ActivityProvider } from "./context/ActivityContext.jsx";


export default function App() {
  return (
    <BrowserRouter>
      <ChatProvider>
        <ActivityProvider>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/chat" element={<ChatTab />} />
          <Route path="/activity" element={<ActivityTab />} />
          <Route path="/account" element={<AccountTab />} />
        </Routes>
        <BottomNav />
        </ActivityProvider>
      </ChatProvider>
    </BrowserRouter>
  );
}
