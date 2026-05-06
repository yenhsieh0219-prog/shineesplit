import React, { useState, useEffect, useMemo } from 'react';
import {
  Gem,
  Users,
  Plus,
  ArrowRightLeft,
  ChevronLeft,
  Copy,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Calculator,
  FileSpreadsheet
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  addDoc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';

// --- Firebase Initialization ---
// 請在這裡貼上您在 Firebase 控制台取得的 config 金鑰
const firebaseConfig = {
  apiKey: "AIzaSyCIt4cu_sPK4y0xjJ_dw-KKg0ba2OsGq7c",
  authDomain: "shineesplit.firebaseapp.com",
  projectId: "shineesplit",
  storageBucket: "shineesplit.firebasestorage.app",
  messagingSenderId: "457841597232",
  appId: "1:457841597232:web:1c77df491ea5fc827d46f5"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 建議將此改為您專屬的 App ID，避免與他人衝突
const appId = 'shinee-split-trip';

// SHINee Elements
const THEME_COLOR = '#88d8c0'; // Pearl Aqua
const AVATARS = [
  { icon: '🐰', name: '斤古王 (Onew)' },
  { icon: '🐶', name: '鐘狗 (Jonghyun)' },
  { icon: '🐹', name: '福實 (Key)' },
  { icon: '🐿️', name: '達拉珉 (Minho)' },
  { icon: '🐥', name: '泰麻里 (Taemin)' },
  { icon: '💎', name: '閃窩' },
];

export default function App() {
  // Global State
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState({ name: '', avatar: '🐰' });
  
  // App Navigation State: 'welcome' | 'room' | 'add_expense' | 'settle'
  const [currentView, setCurrentView] = useState('welcome');
  const [roomId, setRoomId] = useState(null);
  const [roomData, setRoomData] = useState(null);
  const [expenses, setExpenses] = useState([]);
  
  // UI State
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null); // { message, type: 'success' | 'error' }

  // Auth Initialization
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser && currentUser.displayName && !profile.name) {
        setProfile(prev => ({ ...prev, name: currentUser.displayName }));
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      showToast("登入成功！✨");
    } catch (err) {
      console.error(err);
      showToast("Google 登入失敗", "error");
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    signOut(auth);
    setRoomId(null);
    setCurrentView('welcome');
  };

  // Room Listener
  useEffect(() => {
    if (!user || !roomId) return;

    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomId);
    const unsubscribeRoom = onSnapshot(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setRoomData(data);
        if (!data.users || !data.users[user.uid]) {
          joinRoomLogic(roomId, profile.name, profile.avatar);
        }
      } else {
        showToast("找不到該房間！", "error");
        setRoomId(null);
        setCurrentView('welcome');
      }
    }, (error) => {
      console.error("Room sync error:", error);
    });

    const expensesRef = collection(db, 'artifacts', appId, 'public', 'data', 'rooms', roomId, 'expenses');
    const unsubscribeExpenses = onSnapshot(expensesRef, (snapshot) => {
      const expList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      expList.sort((a, b) => b.createdAt - a.createdAt);
      setExpenses(expList);
    }, (error) => {
      console.error("Expenses sync error:", error);
    });

    return () => {
      unsubscribeRoom();
      unsubscribeExpenses();
    };
  }, [user, roomId]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const createRoom = async () => {
    if (!profile.name.trim()) return showToast("請輸入暱稱", "error");
    setLoading(true);
    try {
      const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
      const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', newRoomId);
      
      await setDoc(roomRef, {
        id: newRoomId,
        createdAt: Date.now(),
        users: {
          [user.uid]: {
            uid: user.uid,
            name: profile.name,
            avatar: profile.avatar
          }
        }
      });
      
      setRoomId(newRoomId);
      setCurrentView('room');
      showToast("房間建立成功！✨");
    } catch (err) {
      console.error(err);
      showToast("建立失敗", "error");
    }
    setLoading(false);
  };

  const joinRoomLogic = async (targetRoomId, name, avatar) => {
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', targetRoomId);
    try {
      const roomSnap = await getDoc(roomRef);
      if (roomSnap.exists()) {
        const data = roomSnap.data();
        const updatedUsers = { ...data.users, [user.uid]: { uid: user.uid, name, avatar } };
        await updateDoc(roomRef, { users: updatedUsers });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const joinRoom = async (inputRoomId) => {
    if (!profile.name.trim()) return showToast("請輸入暱稱", "error");
    if (!inputRoomId.trim()) return showToast("請輸入房間代碼", "error");
    setLoading(true);
    try {
      const targetId = inputRoomId.trim().toUpperCase();
      const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', targetId);
      const roomSnap = await getDoc(roomRef);
      if (roomSnap.exists()) {
        setRoomId(targetId);
        setCurrentView('room');
        showToast("成功加入房間！💎");
      } else {
        showToast("找不到此房間", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("加入失敗", "error");
    }
    setLoading(false);
  };

  const leaveRoom = () => {
    setRoomId(null);
    setRoomData(null);
    setExpenses([]);
    setCurrentView('welcome');
  };

  if (loading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0f9f6]">
        <div className="animate-spin text-[#88d8c0]">
          <Gem size={48} />
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginView onLogin={loginWithGoogle} />;
  }

  return (
    <div className="min-h-screen bg-[#f0f9f6] text-gray-800 font-sans selection:bg-[#88d8c0] selection:text-white">
      {toast && (
        <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 flex items-center px-4 py-3 rounded-full shadow-lg transition-all ${toast.type === 'error' ? 'bg-red-100 text-red-600' : 'bg-white text-[#4eb094]'}`}>
          {toast.type === 'error' ? <AlertCircle size={20} className="mr-2" /> : <CheckCircle2 size={20} className="mr-2 text-[#88d8c0]" />}
          <span className="font-medium">{toast.message}</span>
        </div>
      )}

      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Gem className="text-[#88d8c0]" size={28} />
            <h1 className="font-bold text-xl text-gray-700 tracking-wide">
              {roomId ? '閃閃一起玩 ✨' : '閃閃記帳'}
            </h1>
          </div>
          <button onClick={logout} className="p-2 text-gray-400 hover:text-red-400 transition-colors">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <main className="max-w-md mx-auto pb-24 relative min-h-[calc(100vh-4rem)]">
        {currentView === 'welcome' && (
          <WelcomeView 
            profile={profile} 
            setProfile={setProfile} 
            onCreate={createRoom} 
            onJoin={joinRoom} 
            loading={loading}
          />
        )}

        {currentView === 'room' && roomData && (
          <RoomDashboard 
            roomId={roomId} 
            roomData={roomData} 
            expenses={expenses} 
            onAdd={() => setCurrentView('add_expense')} 
            onSettle={() => setCurrentView('settle')}
            currentUser={user}
            showToast={showToast}
          />
        )}

        {currentView === 'add_expense' && roomData && (
          <AddExpenseView 
            roomData={roomData} 
            currentUser={user} 
            onCancel={() => setCurrentView('room')} 
            onSave={() => setCurrentView('room')}
            showToast={showToast}
          />
        )}

        {currentView === 'settle' && roomData && (
          <SettleUpView 
            roomData={roomData} 
            expenses={expenses} 
            onBack={() => setCurrentView('room')} 
            currentUser={user}
          />
        )}
      </main>
    </div>
  );
}

function LoginView({ onLogin }) {
  return (
    <div className="min-h-screen bg-[#f0f9f6] flex flex-col items-center justify-center p-6">
      <div className="max-w-sm w-full bg-white p-10 rounded-[40px] shadow-xl text-center space-y-8">
        
        {/* 鑽石圖示 */}
        <div className="flex justify-center">
          <div className="w-24 h-24 bg-[#88d8c0] rounded-3xl flex items-center justify-center shadow-lg">
            <Gem size={48} className="text-white" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-black text-gray-800">閃閃記帳</h1>
          <p className="text-gray-500 font-medium">旅遊分帳，資料同步不遺失！</p>
        </div>
        
        {/* 修復後的 Google 登入按鈕 */}
        <button 
          onClick={onLogin}
          className="w-full py-4 rounded-2xl font-bold text-gray-700 bg-white border-2 border-gray-100 shadow-sm hover:bg-gray-50 transition-all flex justify-center items-center gap-3"
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          使用 Google 帳號快速開始
        </button>

        <p className="text-xs text-gray-400">Design for SHINee World</p>
      </div>
    </div>
  );
}

function WelcomeView({ profile, setProfile, onCreate, onJoin, loading }) {
  const [joinId, setJoinId] = useState('');

  return (
    <div className="p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center space-y-2 mt-4">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-white shadow-md text-5xl mb-4 relative overflow-hidden">
          <div className="absolute inset-0 bg-[#88d8c0] opacity-20 animate-pulse"></div>
          {profile.avatar}
        </div>
        <h2 className="text-2xl font-bold text-gray-800">準備好出發了嗎？</h2>
        <p className="text-sm text-gray-500">選擇你的代表元素，建立專屬記帳房間</p>
      </div>

      <div className="bg-white p-6 rounded-3xl shadow-sm space-y-6">
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-gray-700">我是誰</label>
          <input 
            type="text" 
            placeholder="輸入你的暱稱" 
            value={profile.name}
            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#88d8c0] transition-all"
          />
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-semibold text-gray-700">代表元素</label>
          <div className="grid grid-cols-3 gap-3">
            {AVATARS.map((av) => (
              <button
                key={av.icon}
                onClick={() => setProfile({ ...profile, avatar: av.icon })}
                className={`py-3 text-2xl rounded-xl transition-all ${profile.avatar === av.icon ? 'bg-[#88d8c0] text-white shadow-md transform scale-105' : 'bg-gray-50 hover:bg-gray-100 grayscale-[0.5]'}`}
                title={av.name}
              >
                {av.icon}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <button 
          onClick={onCreate}
          disabled={loading}
          className="w-full py-4 rounded-2xl font-bold text-white bg-[#88d8c0] shadow-[0_8px_0_0_#5eb89e] active:shadow-[0_0px_0_0_#5eb89e] active:translate-y-2 transition-all flex justify-center items-center gap-2"
        >
          <Plus size={20} />
          🏡建立新房間
        </button>

        <div className="flex items-center space-x-2 mt-6">
          <hr className="flex-1 border-gray-200" />
          <span className="text-xs text-gray-400 font-medium">或</span>
          <hr className="flex-1 border-gray-200" />
        </div>

        <div className="flex gap-2">
          <input 
            type="text" 
            placeholder="輸入房間代碼" 
            value={joinId}
            onChange={(e) => setJoinId(e.target.value.toUpperCase())}
            className="flex-1 px-4 py-3 rounded-2xl bg-white border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#88d8c0] font-mono text-center tracking-widest uppercase"
          />
          <button 
            onClick={() => onJoin(joinId)}
            disabled={loading}
            className="px-6 py-3 rounded-2xl font-bold text-[#4eb094] bg-[#e6f7f2] hover:bg-[#d0efe6] transition-colors"
          >
            加入
          </button>
        </div>
      </div>
    </div>
  );
}

function RoomDashboard({ roomId, roomData, expenses, onAdd, onSettle, currentUser, showToast }) {
  const usersArray = Object.values(roomData.users || {});
  const [showSheetConfig, setShowSheetConfig] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState(roomData.sheetWebhookUrl || '');

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId).then(() => {
      showToast("房間代碼已複製！快分享給朋友～");
    });
  };

  const saveWebhook = async () => {
    try {
      const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomId);
      await updateDoc(roomRef, { sheetWebhookUrl: webhookUrl.trim() });
      setShowSheetConfig(false);
      showToast("Google Sheet 綁定成功！📊");
    } catch (e) {
      showToast("綁定失敗", "error");
    }
  };

  const myTotalPaid = expenses
    .filter(e => e.payerId === currentUser.uid)
    .reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <div className="p-4 space-y-6 animate-in fade-in duration-300">
      <div className="bg-[#88d8c0] p-5 rounded-3xl text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-20">
          <Gem size={80} />
        </div>
        <div className="relative z-10 flex justify-between items-start">
          <div>
            <p className="text-teal-50 text-sm font-medium mb-1">房間代碼</p>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-black tracking-widest font-mono drop-shadow-sm">{roomId}</span>
              <button onClick={copyRoomId} className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors">
                <Copy size={16} />
              </button>
            </div>
          </div>
          <div className="text-right">
            <p className="text-teal-50 text-sm font-medium mb-1">我付出的總額</p>
            <p className="text-2xl font-bold">${myTotalPaid.toLocaleString()}</p>
          </div>
        </div>
        
        <div className="mt-5 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <div className="flex -space-x-3">
            {usersArray.map(u => (
              <div key={u.uid} className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-lg shadow-sm border-2 border-[#88d8c0] relative group" title={u.name}>
                {u.avatar}
              </div>
            ))}
          </div>
          <span className="text-teal-50 text-sm ml-2 font-medium">{usersArray.length} 人參與</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <button 
          onClick={() => setShowSheetConfig(!showSheetConfig)}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <FileSpreadsheet size={20} className={roomData.sheetWebhookUrl ? "text-[#4eb094]" : "text-gray-400"} />
            <span className="font-bold text-gray-700">Google Sheet 備份</span>
          </div>
          <span className="text-xs font-medium px-2 py-1 rounded-md bg-gray-100 text-gray-500">
            {roomData.sheetWebhookUrl ? '已綁定' : '未設定'}
          </span>
        </button>
        
        {showSheetConfig && (
          <div className="p-4 border-t border-gray-100 bg-gray-50 space-y-3 animate-in slide-in-from-top-2">
            <p className="text-xs text-gray-500">輸入 Google Apps Script Webhook 網址，新增記帳時會自動寫入。</p>
            <input 
              type="text" 
              placeholder="https://script.google.com/macros/s/..." 
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#88d8c0]"
            />
            <div className="flex gap-2">
              <button onClick={saveWebhook} className="flex-1 py-2 bg-[#88d8c0] text-white rounded-xl text-sm font-bold shadow-sm hover:bg-[#72c9b0]">
                儲存網址
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button onClick={onAdd} className="bg-white p-4 rounded-2xl shadow-sm flex flex-col items-center justify-center gap-2 hover:bg-gray-50 active:scale-95 transition-all group border border-gray-100">
          <div className="w-12 h-12 rounded-full bg-[#e6f7f2] text-[#4eb094] flex items-center justify-center group-hover:scale-110 transition-transform">
            <Plus size={24} strokeWidth={3} />
          </div>
          <span className="font-bold text-gray-700">記一筆</span>
        </button>
        <button onClick={onSettle} className="bg-white p-4 rounded-2xl shadow-sm flex flex-col items-center justify-center gap-2 hover:bg-gray-50 active:scale-95 transition-all group border border-gray-100">
          <div className="w-12 h-12 rounded-full bg-[#fef0eb] text-[#f48c71] flex items-center justify-center group-hover:scale-110 transition-transform">
            <Calculator size={24} strokeWidth={3} />
          </div>
          <span className="font-bold text-gray-700">去結算</span>
        </button>
      </div>

      <div className="space-y-4">
        <h3 className="font-bold text-gray-700 flex items-center gap-2 px-2">
          <ArrowRightLeft size={18} className="text-[#88d8c0]" />
          帳單明細
        </h3>
        
        {expenses.length === 0 ? (
          <div className="text-center py-10 text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200">
            <Gem size={32} className="mx-auto mb-3 opacity-30" />
            <p>還沒有任何記帳紀錄喔！</p>
          </div>
        ) : (
          <div className="space-y-3">
            {expenses.map((exp) => {
              const isMe = exp.payerId === currentUser.uid;
              const dateObj = new Date(exp.createdAt);
              const dateStr = `${dateObj.getMonth()+1}/${dateObj.getDate()} ${dateObj.getHours().toString().padStart(2,'0')}:${dateObj.getMinutes().toString().padStart(2,'0')}`;
              
              return (
                <div key={exp.id} className="bg-white p-4 rounded-2xl shadow-sm flex items-center justify-between border border-gray-50">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-2xl shrink-0">
                      {roomData.users[exp.payerId]?.avatar || '👤'}
                    </div>
                    <div>
                      <p className="font-bold text-gray-800">{exp.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{dateStr} • {roomData.users[exp.payerId]?.name} 先付</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold text-lg ${isMe ? 'text-[#4eb094]' : 'text-gray-700'}`}>
                      ${Number(exp.amount).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      分給 {Object.keys(exp.splits).length} 人
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function AddExpenseView({ roomData, currentUser, onCancel, onSave, showToast }) {
  const usersArray = Object.values(roomData.users || {});
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [payerId, setPayerId] = useState(currentUser.uid);
  const [splitMode, setSplitMode] = useState('even');
  const [involvedIds, setInvolvedIds] = useState(usersArray.map(u => u.uid)); 
  const [customSplits, setCustomSplits] = useState({});

  useEffect(() => {
    if (splitMode === 'custom') {
      const initSplits = {};
      usersArray.forEach(u => initSplits[u.uid] = '');
      setCustomSplits(initSplits);
    } else if (splitMode === 'single_borrow') {
      const others = usersArray.filter(u => u.uid !== payerId);
      setInvolvedIds(others.length > 0 ? [others[0].uid] : [payerId]);
    }
  }, [splitMode, payerId]);

  const toggleInvolved = (uid) => {
    if (splitMode === 'single_borrow') {
      setInvolvedIds([uid]);
    } else {
      setInvolvedIds(prev => 
        prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
      );
    }
  };

  const handleCustomChange = (uid, val) => {
    if (val !== '' && !/^\d+$/.test(val)) return;
    setCustomSplits(prev => ({ ...prev, [uid]: val }));
  };

  const handleSave = async () => {
    if (!title.trim()) return showToast("請輸入項目", "error");
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) return showToast("請輸入金額", "error");

    let finalSplits = {};
    if (splitMode === 'even') {
      const splitAmount = Math.round((numAmount / involvedIds.length) * 100) / 100;
      let totalAssigned = 0;
      involvedIds.forEach((uid, index) => {
        if (index === involvedIds.length - 1) finalSplits[uid] = numAmount - totalAssigned;
        else { finalSplits[uid] = splitAmount; totalAssigned += splitAmount; }
      });
    } else if (splitMode === 'single_borrow') {
      finalSplits[involvedIds[0]] = numAmount;
    } else if (splitMode === 'custom') {
      Object.entries(customSplits).forEach(([uid, val]) => {
        if (Number(val) > 0) finalSplits[uid] = Number(val);
      });
    }

    try {
      const db_ref = collection(db, 'artifacts', appId, 'public', 'data', 'rooms', roomData.id, 'expenses');
      await addDoc(db_ref, {
        title: title.trim(),
        amount: numAmount,
        payerId: payerId,
        splits: finalSplits,
        createdAt: Date.now()
      });

      if (roomData.sheetWebhookUrl) {
        const payerName = roomData.users[payerId]?.name || '未知';
        const splitDetails = Object.entries(finalSplits).map(([uid, amt]) => {
          const userName = roomData.users[uid]?.name || '未知';
          return `${userName}: $${amt}`;
        }).join(', ');

        fetch(roomData.sheetWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            date: new Date().toLocaleString('zh-TW'),
            payer: payerName,
            title: title.trim(),
            amount: numAmount,
            splitDetails: splitDetails
          })
        }).catch(e => console.error("Sync error", e));
      }

      showToast("新增成功！💎");
      onSave();
    } catch (err) {
      showToast("儲存失敗", "error");
    }
  };

  return (
    <div className="bg-white min-h-[calc(100vh-4rem)] p-4 flex flex-col animate-in slide-in-from-right-4 duration-300">
      <div className="flex items-center mb-6">
        <button onClick={onCancel} className="p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors">
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-xl font-bold ml-2 text-gray-800">新增記帳</h2>
      </div>

      <div className="flex-1 space-y-6">
        <div className="space-y-4 bg-gray-50 p-5 rounded-2xl border border-gray-100">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">買了什麼？</label>
            <input 
              type="text" 
              placeholder="例如：晚餐、門票" 
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full mt-1 px-0 py-2 bg-transparent border-b-2 border-gray-200 focus:border-[#88d8c0] focus:outline-none text-xl font-bold text-gray-800 transition-colors"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">總金額</label>
            <div className="flex items-end mt-1">
              <span className="text-2xl font-bold text-gray-400 mr-2">$</span>
              <input 
                type="number" 
                placeholder="0" 
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full px-0 py-2 bg-transparent border-b-2 border-gray-200 focus:border-[#88d8c0] focus:outline-none text-3xl font-black text-[#4eb094] transition-colors"
              />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-sm font-bold text-gray-700">誰先付錢的？</label>
          <div className="flex overflow-x-auto gap-3 pb-2 scrollbar-hide">
            {usersArray.map(u => (
              <button 
                key={u.uid}
                onClick={() => setPayerId(u.uid)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full border-2 transition-all whitespace-nowrap ${payerId === u.uid ? 'border-[#88d8c0] bg-[#e6f7f2] text-[#4eb094] font-bold' : 'border-gray-100 bg-white text-gray-500'}`}
              >
                <span>{u.avatar}</span>
                <span>{u.uid === currentUser.uid ? '我' : u.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 pt-4 border-t border-gray-100">
          <label className="text-sm font-bold text-gray-700">分攤方式</label>
          <div className="grid grid-cols-3 gap-2 bg-gray-100 p-1 rounded-xl">
            {['even', 'single_borrow', 'custom'].map(m => (
              <button
                key={m}
                onClick={() => setSplitMode(m)}
                className={`py-2 text-sm font-bold rounded-lg transition-all ${splitMode === m ? 'bg-white shadow-sm text-[#4eb094]' : 'text-gray-500'}`}
              >
                {m === 'even' ? '平分' : m === 'single_borrow' ? '幫人付' : '自訂'}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
            <div className="space-y-2">
                {usersArray.map(u => {
                  const isSelected = involvedIds.includes(u.uid);
                  return (
                    <div 
                      key={u.uid} 
                      onClick={() => toggleInvolved(u.uid)}
                      className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${isSelected ? 'bg-white border-2 border-[#88d8c0] shadow-sm' : 'bg-transparent border-2 border-transparent hover:bg-gray-100'}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{u.avatar}</span>
                        <span className="font-medium text-gray-800">{u.name}</span>
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-[#88d8c0] border-[#88d8c0]' : 'border-gray-300'}`}>
                        {isSelected && <CheckCircle2 size={16} className="text-white" />}
                      </div>
                    </div>
                  );
                })}
            </div>
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-gray-100 bg-white sticky bottom-0 pb-4">
        <button 
          onClick={handleSave}
          className="w-full py-4 rounded-2xl font-bold text-white bg-[#88d8c0] shadow-[0_6px_0_0_#5eb89e] active:shadow-[0_0px_0_0_#5eb89e] active:translate-y-[6px] transition-all"
        >
          儲存紀錄
        </button>
      </div>
    </div>
  );
}

function SettleUpView({ roomData, expenses, onBack, currentUser }) {
  const usersArray = Object.values(roomData.users || {});
  
  const balances = useMemo(() => {
    const bal = {};
    usersArray.forEach(u => bal[u.uid] = 0);
    expenses.forEach(exp => {
      if (bal[exp.payerId] !== undefined) bal[exp.payerId] += Number(exp.amount);
      Object.entries(exp.splits || {}).forEach(([uid, amount]) => {
        if (bal[uid] !== undefined) bal[uid] -= Number(amount);
      });
    });
    return bal;
  }, [expenses, usersArray]);

  const settlements = useMemo(() => {
    const debtors = [];
    const creditors = [];
    Object.entries(balances).forEach(([uid, amount]) => {
      if (amount < -0.01) debtors.push({ uid, amount: Math.abs(amount) });
      else if (amount > 0.01) creditors.push({ uid, amount });
    });
    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);
    const txs = [];
    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const d = debtors[i], c = creditors[j];
      const amt = Math.min(d.amount, c.amount);
      txs.push({ from: d.uid, to: c.uid, amount: Math.round(amt) });
      d.amount -= amt; c.amount -= amt;
      if (d.amount < 0.01) i++;
      if (c.amount < 0.01) j++;
    }
    return txs;
  }, [balances]);

  const myBalance = balances[currentUser.uid] || 0;

  return (
    <div className="min-h-[calc(100vh-4rem)] p-4 flex flex-col animate-in slide-in-from-left-4 duration-300">
      <div className="flex items-center mb-6">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors">
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-xl font-bold ml-2 text-gray-800">結算帳務</h2>
      </div>

      <div className={`p-6 rounded-3xl text-white shadow-sm mb-8 relative overflow-hidden ${myBalance >= 0 ? 'bg-[#88d8c0]' : 'bg-[#f4a28c]'}`}>
        <div className="relative z-10">
          <p className="text-white/80 font-medium mb-1">我的結算狀態</p>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black tracking-tighter">
              {myBalance > 0 ? '+' : ''}{Math.round(myBalance)}
            </span>
            <span className="font-bold">元</span>
          </div>
          <p className="text-sm mt-2 opacity-90">
            {myBalance > 0 ? '收錢囉！' : myBalance < 0 ? '記得還錢！' : '帳務平衡！'}
          </p>
        </div>
      </div>

      <div className="flex-1">
        <h3 className="font-bold text-gray-700 flex items-center gap-2 px-2 mb-4">
          <Gem size={18} className="text-[#88d8c0]" />
          最佳還款方案
        </h3>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-50 flex items-center justify-between">
  {/* 付款方 (例如：HY H) */}
  <div className="flex flex-col items-center flex-1">
    <div className="text-3xl mb-1">{memberIcons[s.from] || '👤'}</div>
    <div className="text-sm font-bold text-gray-600">{s.from}</div>
  </div>

  {/* 中間的引導區塊：改為單向箭頭與文字 */}
  <div className="flex flex-col items-center px-4 flex-1">
    <span className="text-[10px] font-bold text-[#88d8c0] mb-1 tracking-widest uppercase">
      應支付給
    </span>
    <div className="flex items-center text-[#ff9a8b]">
      <MoveRight size={24} strokeWidth={3} />
      <span className="text-lg font-black ml-2">${s.amount.toLocaleString()}</span>
    </div>
  </div>

  {/* 受款方 (例如：我) */}
  <div className="flex flex-col items-center flex-1">
    <div className="text-3xl mb-1">{memberIcons[s.to] || '👤'}</div>
    <div className="text-sm font-bold text-gray-600">{s.to}</div>
  </div>
</div>
      </div>
    </div>
  );
}
