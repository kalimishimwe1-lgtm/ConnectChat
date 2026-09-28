import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import api from "../api";

export default function Chat() {
  const user = JSON.parse(localStorage.getItem("chat_user"));
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState("");
  const [profile, setProfile] = useState(user);
  const [showProfile, setShowProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: user.name || "", bio: "" });
  const socketRef = useRef(null);
  const messagesEnd = useRef(null);

  useEffect(() => {
    loadConversations();
    loadProfile();

    const socket = io("http://localhost:5000", {
      auth: {
        token: localStorage.getItem("chat_token")
      }
    });

    socketRef.current = socket;

    socket.on("new_message", (message) => {
      setMessages((old) => [...old, message]);
      loadConversations();
    });

    socket.on("user_typing", (data) => {
      setTyping(`${data.name} is typing...`);
      setTimeout(() => setTyping(""), 1500);
    });

    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadConversations() {
    try {
      const { data } = await api.get("/conversations");
      setConversations(data);
    } catch (error) {
      console.error(error);
    }
  }


  async function loadProfile() {
    try {
      const { data } = await api.get("/profile/me");
      setProfile(data);
      setProfileForm({ name: data.name || "", bio: data.bio || "" });
      localStorage.setItem("chat_user", JSON.stringify(data));
    } catch (error) { console.error(error); }
  }

  async function saveProfile(e) {
    e.preventDefault();
    try {
      const { data } = await api.put("/profile/me", profileForm);
      setProfile(data);
      localStorage.setItem("chat_user", JSON.stringify(data));
    } catch (error) { alert(error.response?.data?.message || "Could not update profile"); }
  }

  async function uploadAvatar(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("avatar", file);
    try {
      const { data } = await api.post("/profile/me/avatar", form);
      setProfile({ ...profile, profile_image: data.profile_image });
      localStorage.setItem("chat_user", JSON.stringify({ ...profile, profile_image: data.profile_image }));
    } catch (error) { alert(error.response?.data?.message || "Upload failed"); }
  }

  async function searchUsers(value) {
    setSearch(value);

    if (!value.trim()) {
      setResults([]);
      return;
    }

    try {
      const { data } = await api.get(
        `/users/search?q=${encodeURIComponent(value)}`
      );
      setResults(data);
    } catch (error) {
      console.error(error);
    }
  }

  async function openUser(otherUser) {
    try {
      const { data } = await api.post("/conversations/private", {
        userId: otherUser.id
      });

      setSearch("");
      setResults([]);

      await openConversation({
        id: data.conversationId,
        other_id: otherUser.id,
        other_name: otherUser.name,
        other_email: otherUser.email,
        is_online: otherUser.is_online
      });

      loadConversations();
    } catch (error) {
      console.error(error);
    }
  }

  async function openConversation(conversation) {
    setSelected(conversation);

    try {
      const { data } = await api.get(
        `/conversations/${conversation.id}/messages`
      );

      setMessages(data);

      socketRef.current?.emit(
        "join_conversation",
        conversation.id
      );
    } catch (error) {
      console.error(error);
    }
  }

  function sendMessage(e) {
    e.preventDefault();

    if (!text.trim() || !selected) return;

    socketRef.current.emit("send_message", {
      conversationId: selected.id,
      message: text
    });

    setText("");
  }

  function logout() {
    localStorage.removeItem("chat_token");
    localStorage.removeItem("chat_user");
    window.location.href = "/login";
  }

  return (
    <div className="chat-app">
      <aside className="sidebar">
        <div className="sidebar-top">
          <div>
            <h2>ChatConnect</h2>
            <small>Hi, {profile.name}</small>
          </div>
          <div className="top-actions"><button className="profile-button" onClick={() => setShowProfile(true)}>Profile</button><button className="logout" onClick={logout}>Logout</button></div>
        </div>

        <div className="search-box">
          <input
            value={search}
            onChange={(e) => searchUsers(e.target.value)}
            placeholder="Search people..."
          />

          {results.length > 0 && (
            <div className="search-results">
              {results.map((person) => (
                <button
                  key={person.id}
                  className="user-result"
                  onClick={() => openUser(person)}
                >
                  <span className="avatar">{person.name[0]}</span>
                  <span>
                    <strong>{person.name}</strong>
                    <small>{person.email}</small>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="conversation-list">
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              className={`conversation ${
                selected?.id === conversation.id ? "active" : ""
              }`}
              onClick={() => openConversation(conversation)}
            >
              <span className="avatar">
                {conversation.other_name?.[0] || "U"}
              </span>

              <span className="conversation-info">
                <strong>{conversation.other_name}</strong>
                <small>
                  {conversation.last_message || "Start a conversation"}
                </small>
              </span>

              {conversation.is_online ? (
                <span className="online-dot"></span>
              ) : null}
            </button>
          ))}

          {!conversations.length && (
            <p className="empty">
              Search for a person above to start a chat.
            </p>
          )}
        </div>
      </aside>

      <main className="chat-window">
        {!selected ? (
          <div className="welcome">
            <div className="welcome-icon">💬</div>
            <h1>Welcome to ChatConnect</h1>
            <p>Search for someone and start a conversation.</p>
          </div>
        ) : (
          <>
            <header className="chat-header">
              <div className="avatar">
                {selected.other_name?.[0] || "U"}
              </div>
              <div>
                <h3>{selected.other_name}</h3>
                <small>
                  {selected.is_online ? "Online" : "Offline"}
                </small>
              </div>
            </header>

            <section className="messages">
              {messages.map((message) => {
                const mine = message.sender_id === user.id;

                return (
                  <div
                    key={message.id}
                    className={`message-row ${mine ? "mine" : ""}`}
                  >
                    <div className="message">
                      <div>{message.message}</div>
                      <small>
                        {new Date(message.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </small>
                    </div>
                  </div>
                );
              })}

              <div className="typing">{typing}</div>
              <div ref={messagesEnd}></div>
            </section>

            <form className="message-form" onSubmit={sendMessage}>
              <input
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  socketRef.current?.emit("typing", {
                    conversationId: selected.id
                  });
                }}
                placeholder="Write a message..."
              />
              <button>Send</button>
            </form>
          </>
        )}
      </main>

      {showProfile && (
        <div className="modal-backdrop" onClick={() => setShowProfile(false)}>
          <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
            <button className="close-modal" onClick={() => setShowProfile(false)}>×</button>
            <div className="profile-large">
              {profile.profile_image ? <img src={`http://localhost:5000${profile.profile_image}`} alt="Profile" /> : profile.name?.[0]}
            </div>
            <label className="upload-label">Change photo<input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadAvatar} hidden /></label>
            <form onSubmit={saveProfile} className="profile-form">
              <label>Name<input value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} /></label>
              <label>Email<input value={profile.email || ""} disabled /></label>
              <label>Bio<textarea value={profileForm.bio} onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })} maxLength={255} placeholder="Tell people about yourself" /></label>
              <button type="submit">Save profile</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
