console.log("💎 閃閃記帳正在運行新版本 💎");

import React, { useState, useEffect, useMemo } from 'react';
import {
  Gem, 
  AlertCircle, 
  LogOut, 
  Calculator, 
  MoveRight, 
  Copy, 
  CheckCircle2,
  ArrowRightLeft,
  ChevronLeft,
  Plus,
  Trash2,
  Clock,
  Pencil
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
  deleteDoc
} from 'firebase/firestore';

// --- Firebase Initialization ---
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

const AVATARS = [
  { icon: '🐰', name: '斤古王' }, { icon: '🐶', name: '鐘狗' },
  { icon: '🐹', name: '福實' }, { icon: '🐿️', name: '達拉珉' },
  { icon: '🐥', name: '泰麻里' }, { icon: '💎', name: '閃窩' },
];

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState({ name: '', avatar: '🐰' });
  const [currentView, setCurrentView] = useState('welcome');
  const [roomId, setRoomId] = useState(null);
  const [roomData, setRoomData] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [roomHistory, setRoomHistory] = useState([]);
  const [editingExpense, setEditingExpense] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        const unsubHistory = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) setRoomHistory(docSnap.data().history || []);
        });
        if (currentUser.displayName && !profile.name) {
          setProfile(prev => ({ ...prev, name: currentUser.displayName }));
        }
        setLoading(false);
        return () => unsubHistory();
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !roomId) return;
    const roomRef = doc(db, 'rooms', roomId);
    const unsubRoom = onSnapshot(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.isDeleted) {
          showToast("此房間已被關閉", "error");
          leaveRoom();
        } else {
          setRoomData(data);
        }
      }
    });

    const expRef = collection(db, 'rooms', roomId, 'expenses');
    const unsubExp = onSnapshot(expRef, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setExpenses(list.sort((a, b) => b.createdAt - a.createdAt));
    });

    return () => { unsubRoom(); unsubExp(); };
  }, [user, roomId]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const leaveRoom = () => {
    setRoomId(null);
    setRoomData(null);
    setExpenses([]);
    setCurrentView('welcome');
  };

  // 💎 修正：100% 穩健的歷史紀錄更新法
  const updateHistory = async (id, name) => {
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    let currentHistory = userSnap.exists() ? (userSnap.data().history || []) : [];
    
    // 用 ID 強制過濾掉舊的，再把新的塞進去
    currentHistory = currentHistory.filter(r => r.id !== id);
    currentHistory.push({ id, name, lastAccess: Date.now() });
    
    await setDoc(userRef, { history: currentHistory }, { merge: true });
  };

  const createRoom = async (roomName) => {
    if (!profile.name.trim() || !roomName.trim()) return showToast("請完整填寫喔", "error");
    setLoading(true);
    try {
      const newId = Math.random().toString(36).substring(2, 8).toUpperCase();
      const roomRef = doc(db, 'rooms', newId);
      await setDoc(roomRef, {
        id: newId, name: roomName, ownerId: user.uid, isDeleted: false, createdAt: Date.now(),
        users: { [user.uid]: { uid: user.uid, name: profile.name, avatar: profile.avatar } }
      });
      await updateHistory(newId, roomName);
      setRoomId(newId);
      setCurrentView('room');
      showToast("房間建立成功！✨");
    } catch (e) { showToast("建立失敗", "error"); }
    setLoading(false);
  };

  const joinRoom = async (inputRoomId) => {
    const targetId = inputRoomId.trim().toUpperCase();
    if (!profile.name.trim() || !targetId) return showToast("請輸入暱稱與房號", "error");
    setLoading(true);
    try {
      const roomRef = doc(db, 'rooms', targetId);
      const snap = await getDoc(roomRef);
      if (snap.exists() && !snap.data().isDeleted) {
        const data = snap.data();
        const updatedUsers = { ...data.users, [user.uid]: { uid: user.uid, name: profile.name, avatar: profile.avatar } };
        await updateDoc(roomRef, { users: updatedUsers });
        await updateHistory(targetId, data.name);
        setRoomId(targetId);
        setCurrentView('room');
      } else { 
        showToast("房間已失效，為您清除紀錄 🧹", "error"); 
        // 💎 修正：自動清道夫，把無效的房間從歷史紀錄砍掉
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const currentHistory = userSnap.data().history || [];
          const updatedHistory = currentHistory.filter(r => r.id !== targetId);
          await updateDoc(userRef, { history: updatedHistory });
        }
      }
    } catch (e) { showToast("加入失敗", "error"); }
    setLoading(false);
  };

  // 💎 修正：穩健的刪除連動機制
  const softDeleteRoom = async (targetId) => {
    if (!window.confirm("確定要刪除這間房嗎？")) return;
    try {
      // 1. 標記房間為刪除
      await updateDoc(doc(db, 'rooms', targetId), { isDeleted: true });
      
      // 2. 精準地從使用者的歷史紀錄中拔除
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const currentHistory = userSnap.data().history || [];
        const updatedHistory = currentHistory.filter(r => r.id !== targetId);
        await updateDoc(userRef, { history: updatedHistory });
      }
      
      showToast("已成功刪除");
      leaveRoom();
    } catch (e) { showToast("操作失敗", "error"); }
  };

  const deleteExpense = async (expenseId) => {
    if (!window.confirm("確定要刪除這筆帳單嗎？刪除後無法復原喔！")) return;
    try {
      await deleteDoc(doc(db, 'rooms', roomId, 'expenses', expenseId));
      showToast("帳單已刪除 🗑️");
    } catch (e) {
      showToast("刪除失敗", "error");
    }
  };

  if (loading && !user) return <div className="h-[100dvh] flex items-center justify-center bg-[#f0f9f6] text-[#88d8c0]"><Gem size={48} className="animate-spin" /></div>;
  if (!user) return <LoginView onLogin={() => signInWithPopup(auth, new GoogleAuthProvider())} />;

  return (
    <div className="h-[100dvh] flex flex-col bg-[#f0f9f6] text-gray-800 font-sans overflow-hidden">
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-2 rounded-full shadow-lg ${toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-[#4eb094] text-white'}`}>
          {toast.message}
        </div>
      )}
      
      <header className="bg-white/90 backdrop-blur-md shadow-sm h-14 flex-shrink-0">
        <div className="max-w-md mx-auto px-4 h-full flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Gem className="text-[#88d8c0]" size={22} />
            <h1 className="font-bold text-base truncate max-w-[150px]">{roomId ? roomData?.name : '閃閃一起玩'}</h1>
          </div>
          <div className="flex gap-1">
            {roomId ? (
              <>
                <button onClick={() => softDeleteRoom(roomId)} className="p-2 text-gray-300 hover:text-red-400">
                  <Trash2 size={18}/>
                </button>
                <button onClick={leaveRoom} className="p-2 text-gray-300 hover:text-[#88d8c0]">
                  <ChevronLeft size={24} />
                </button>
              </>
            ) : (
              <button onClick={() => signOut(auth)} className="p-2 text-gray-300 hover:text-gray-600">
                <LogOut size={18}/>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-md mx-auto w-full overflow-y-auto overflow-x-hidden relative">
        {currentView === 'welcome' && <WelcomeView profile={profile} setProfile={setProfile} onCreate={createRoom} onJoin={joinRoom} history={roomHistory} loading={loading} />}
        
        {currentView === 'room' && roomData && (
          <RoomDashboard 
            roomId={roomId} 
            roomData={roomData} 
            expenses={expenses} 
            onAdd={() => {
              setEditingExpense(null);
              setCurrentView('add_expense');
            }} 
            onEdit={(exp) => {
              setEditingExpense(exp);
              setCurrentView('add_expense');
            }}
            onDelete={deleteExpense}
            onSettle={() => setCurrentView('settle')} 
            currentUser={user} 
            showToast={showToast} 
          />
        )}

        {currentView === 'add_expense' && roomData && (
          <AddExpenseView 
            roomData={roomData} 
            currentUser={user} 
            editingExpense={editingExpense} 
            onCancel={() => setCurrentView('room')} 
            onSave={() => setCurrentView('room')} 
            showToast={showToast} 
          />
        )}

        {currentView === 'settle' && roomData && <SettleUpView roomData={roomData} expenses={expenses} onBack={() => setCurrentView('room')} currentUser={user} />}
      </main>
    </div>
  );
}

function WelcomeView({ profile, setProfile, onCreate, onJoin, history, loading }) {
  const [roomName, setRoomName] = useState('');
  const [joinId, setJoinId] = useState('');
  
  return (
    <div className="h-full p-5 flex flex-col justify-center gap-5 animate-in fade-in duration-500">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white shadow-xl text-4xl border-4 border-[#88d8c0]">{profile.avatar}</div>
        <input type="text" value={profile.name} onChange={e => setProfile({...profile, name: e.target.value})} className="text-center font-black text-xl bg-transparent border-b-2 border-dashed border-gray-200 outline-none focus:border-[#88d8c0] w-full" />
      </div>

      <div className="bg-white p-5 rounded-[28px] shadow-sm border border-gray-50 space-y-4">
        <p className="font-bold text-gray-700 text-xs px-1">建立新的分帳房</p>
        <input type="text" placeholder="輸入旅遊名稱" value={roomName} onChange={e => setRoomName(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-gray-50 outline-none focus:ring-2 focus:ring-[#88d8c0] text-sm" />
        <div className="grid grid-cols-6 gap-1.5">
          {AVATARS.map(av => (
            <button key={av.icon} onClick={() => setProfile({...profile, avatar: av.icon})} className={`aspect-square rounded-lg flex items-center justify-center text-xl transition-all ${profile.avatar === av.icon ? 'bg-[#88d8c0] scale-90' : 'bg-gray-50'}`}>{av.icon}</button>
          ))}
        </div>
        <button onClick={() => onCreate(roomName)} disabled={loading} className="w-full py-4 bg-[#88d8c0] text-white rounded-2xl font-bold shadow-[0_6px_0_0_#5eb89e] active:translate-y-[6px] active:shadow-none transition-all text-sm">開始記帳</button>
      </div>

      <div className="flex gap-2">
        <input type="text" placeholder="輸入房號加入" value={joinId} onChange={e => setJoinId(e.target.value.toUpperCase())} className="flex-1 px-4 py-3.5 rounded-xl bg-white border border-gray-100 outline-none text-center font-mono tracking-widest font-bold text-sm" />
        <button onClick={() => onJoin(joinId)} className="px-6 bg-[#88d8c0] text-white rounded-xl font-bold shadow-[0_6px_0_0_#5eb89e] active:translate-y-[5px] active:shadow-none transition-all text-sm">加入</button>
      </div>

      {history.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 flex items-center gap-1"><Clock size={12}/> 最近紀錄</p>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {history.sort((a,b)=>b.lastAccess - a.lastAccess).slice(0,5).map(r => (
              <button key={r.id} onClick={() => onJoin(r.id)} className="flex-shrink-0 bg-white px-4 py-2 rounded-full shadow-sm border border-gray-50 text-xs font-bold text-gray-600 hover:border-[#88d8c0]">
                {r.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RoomDashboard({ roomId, roomData, expenses, onAdd, onEdit, onDelete, onSettle, currentUser, showToast }) {
  const usersArray = Object.values(roomData.users || {});
  const myTotal = expenses.filter(e => e.payerId === currentUser.uid).reduce((sum, e) => sum + Number(e.amount), 0);
  
  const copyId = () => { 
    navigator.clipboard.writeText(roomId); 
    showToast("房號已複製！💎"); 
  };

  return (
    <div className="p-4 space-y-5 animate-in fade-in duration-500">
      <div className="bg-gradient-to-br from-[#88d8c0] to-[#72c9b0] p-5 rounded-[28px] text-white shadow-xl flex justify-between items-center relative overflow-hidden">
        <div className="space-y-2 relative z-10">
          <p className="text-[9px] font-black uppercase opacity-70 tracking-tighter font-mono">Room Code</p>
          <div className="flex items-center gap-2 cursor-pointer group" onClick={copyId}>
            <h2 className="text-4xl font-black tracking-widest drop-shadow-md group-hover:scale-105 transition-transform">{roomId}</h2>
            <Copy size={16} className="opacity-50 group-hover:opacity-100" />
          </div>
          <div className="flex -space-x-1.5 pt-2">{usersArray.map(u => <div key={u.uid} className="w-7 h-7 rounded-full bg-white/20 border-2 border-[#88d8c0] flex items-center justify-center text-xs">{u.avatar}</div>)}</div>
        </div>
        <div className="text-right relative z-10"><p className="text-[10px] opacity-80 font-bold">我付出的總額</p><p className="text-3xl font-black">${myTotal.toLocaleString()}</p></div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button onClick={onAdd} className="bg-white p-5 rounded-[24px] shadow-sm flex flex-col items-center gap-3 active:scale-95 transition-all"><div className="w-10 h-10 rounded-full bg-[#e6f7f2] flex items-center justify-center"><Plus className="text-[#4eb094]" size={20} strokeWidth={3} /></div><b className="text-sm">記一筆</b></button>
        <button onClick={onSettle} className="bg-white p-5 rounded-[24px] shadow-sm flex flex-col items-center gap-3 active:scale-95 transition-all"><div className="w-10 h-10 rounded-full bg-[#fff0ed] flex items-center justify-center"><Calculator className="text-[#f48c71]" size={20} strokeWidth={3} /></div><b className="text-sm">去結算</b></button>
      </div>

      <div className="space-y-2.5">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">帳單明細</p>
        {expenses.length === 0 ? (
          <div className="py-10 text-center text-gray-300 font-bold border-2 border-dashed border-gray-100 rounded-[28px] text-sm">還沒有任何紀錄喔</div>
        ) : (
          <div className="space-y-2.5">
            {expenses.map(exp => (
              <div key={exp.id} className="bg-white p-3.5 rounded-xl flex items-center justify-between shadow-sm border border-gray-50">
                <div className="flex items-center gap-3 text-lg">
                  {roomData.users[exp.payerId]?.avatar}
                  <div>
                    <p className="font-bold text-sm text-gray-800">{exp.title}</p>
                    <p className="text-[9px] text-gray-400 font-bold uppercase">{roomData.users[exp.payerId]?.name} 先付</p>
                  </div>
                </div>
                
                <div className="text-right flex flex-col items-end gap-1.5">
                  <p className="font-black text-[#4eb094] text-sm">${Number(exp.amount).toLocaleString()}</p>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => onEdit(exp)} className="p-1.5 text-gray-400 hover:text-[#88d8c0] bg-gray-50 hover:bg-[#e6f7f2] rounded-md transition-colors" title="編輯">
                      <Pencil size={12} />
                    </button>
                    <button onClick={() => onDelete(exp.id)} className="p-1.5 text-gray-400 hover:text-red-400 bg-gray-50 hover:bg-red-50 rounded-md transition-colors" title="刪除">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AddExpenseView({ roomData, currentUser, editingExpense, onCancel, onSave, showToast }) {
  const usersArray = Object.values(roomData.users || {});
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [payerId, setPayerId] = useState(currentUser.uid);
  const [splitMode, setSplitMode] = useState('even');
  const [involvedIds, setInvolvedIds] = useState([]); 

  useEffect(() => {
    if (editingExpense) {
      setTitle(editingExpense.title || '');
      setAmount(editingExpense.amount ? editingExpense.amount.toString() : '');
      setPayerId(editingExpense.payerId || currentUser.uid);
      setSplitMode(editingExpense.splitMode || 'even');
      
      if (editingExpense.involvedIds) {
        setInvolvedIds(editingExpense.involvedIds);
      } else {
        setInvolvedIds(Object.keys(editingExpense.splits || {}));
      }
    } else {
      setTitle('');
      setAmount('');
      setPayerId(currentUser.uid);
      setSplitMode('even');
      setInvolvedIds(Object.keys(roomData.users || {}));
    }
  }, [editingExpense?.id, roomData.users, currentUser.uid]);

  const handleModeChange = (mode) => {
    setSplitMode(mode);
    if (mode === 'single_borrow') {
      const others = usersArray.filter(u => u.uid !== payerId);
      if (involvedIds.length !== 1) {
        setInvolvedIds(others.length > 0 ? [others[0].uid] : [payerId]);
      }
    } else if (mode === 'even') {
      setInvolvedIds(usersArray.map(u => u.uid));
    }
  };

  const toggleInvolved = (uid) => {
    if (splitMode === 'single_borrow') {
      setInvolvedIds([uid]);
    } else {
      setInvolvedIds(prev => 
        prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
      );
    }
  };

  const handleSave = async () => {
    if (!title.trim() || !amount) return showToast("請完整填寫項目與金額", "error");
    const numAmount = Number(amount);
    if (involvedIds.length === 0) return showToast("請至少選擇一位分攤者", "error");
    
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
    }

    try {
      const expenseData = {
        title: title.trim(),
        amount: numAmount,
        payerId: payerId,
        splits: finalSplits,
        splitMode: splitMode,
        involvedIds: involvedIds,
        updatedAt: Date.now()
      };

      if (editingExpense) {
        await updateDoc(doc(db, 'rooms', roomData.id, 'expenses', editingExpense.id), expenseData);
        showToast("帳單已更新！💎");
      } else {
        expenseData.createdAt = Date.now();
        await addDoc(collection(db, 'rooms', roomData.id, 'expenses'), expenseData);
        showToast("新增成功！💎");
      }
      
      onSave();
    } catch (err) {
      showToast("儲存失敗", "error");
    }
  };

  return (
    <div className="p-5 flex flex-col gap-5 animate-in slide-in-from-right-8 pb-32">
      <div className="flex items-center"><button onClick={onCancel} className="p-1"><ChevronLeft size={24}/></button><h2 className="text-xl font-black ml-1">{editingExpense ? '編輯記帳' : '新增記帳'}</h2></div>
      
      <div className="bg-white p-6 rounded-[32px] shadow-sm space-y-6 flex-shrink-0">
        <div className="space-y-1"><p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">項目</p><input type="text" placeholder="買了什麼？" value={title} onChange={e => setTitle(e.target.value)} className="w-full text-lg font-bold border-b-2 border-gray-50 py-2 outline-none focus:border-[#88d8c0]" /></div>
        <div className="space-y-1"><p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">金額</p><div className="flex items-baseline"><span className="text-2xl font-black text-[#88d8c0] mr-2">$</span><input type="number" placeholder="0" value={amount} onChange={e => setAmount(e.target.value)} className="w-full text-4xl font-black text-[#4eb094] outline-none" /></div></div>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-black text-gray-400 uppercase px-1">誰先付錢的？</p>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {usersArray.map(u => (
            <button 
              key={u.uid} 
              onClick={() => setPayerId(u.uid)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full border-2 transition-all whitespace-nowrap ${payerId === u.uid ? 'border-[#88d8c0] bg-[#e6f7f2] text-[#4eb094] font-bold' : 'border-gray-100 bg-white text-gray-400'}`}
            >
              <span>{u.avatar}</span>
              <span className="text-xs">{u.uid === currentUser.uid ? '我' : u.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 pt-2 border-t border-gray-100">
        <p className="text-xs font-black text-gray-400 uppercase px-1">分攤方式</p>
        <div className="grid grid-cols-2 gap-2 bg-gray-100 p-1 rounded-xl">
          <button onClick={() => handleModeChange('even')} className={`py-2 text-xs font-bold rounded-lg transition-all ${splitMode === 'even' ? 'bg-white text-[#4eb094] shadow-sm' : 'text-gray-400'}`}>大家平分</button>
          <button onClick={() => handleModeChange('single_borrow')} className={`py-2 text-xs font-bold rounded-lg transition-all ${splitMode === 'single_borrow' ? 'bg-white text-[#4eb094] shadow-sm' : 'text-gray-400'}`}>幫特定人付</button>
        </div>
      </div>

      <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100 mb-6">
          <div className="space-y-1">
              {usersArray.map(u => {
                const isSelected = involvedIds.includes(u.uid);
                return (
                  <div 
                    key={u.uid} 
                    onClick={() => toggleInvolved(u.uid)}
                    className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${isSelected ? 'bg-white border-2 border-[#88d8c0] shadow-sm' : 'bg-transparent border-2 border-transparent hover:bg-gray-100'}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{u.avatar}</span>
                      <span className="font-medium text-sm text-gray-800">{u.name}</span>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-[#88d8c0] border-[#88d8c0]' : 'border-gray-300'}`}>
                      {isSelected && <CheckCircle2 size={14} className="text-white" />}
                    </div>
                  </div>
                );
              })}
          </div>
      </div>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md p-5 pb-8 bg-gradient-to-t from-[#f0f9f6] via-[#f0f9f6] to-transparent z-10 pointer-events-none flex flex-col justify-end">
        <button onClick={handleSave} className="w-full py-4 bg-[#88d8c0] text-white rounded-2xl font-black text-base shadow-[0_6px_0_0_#5eb89e] active:translate-y-[6px] active:shadow-none transition-all pointer-events-auto">
          {editingExpense ? '儲存修改' : '儲存紀錄'}
        </button>
      </div>
    </div>
  );
}

function SettleUpView({ roomData, expenses, onBack, currentUser }) {
  const usersArray = Object.values(roomData.users || {});
  
  const balances = useMemo(() => {
    const bal = {}; usersArray.forEach(u => bal[u.uid] = 0);
    expenses.forEach(exp => {
      if (bal[exp.payerId] !== undefined) bal[exp.payerId] += Number(exp.amount);
      Object.entries(exp.splits || {}).forEach(([uid, amt]) => { if (bal[uid] !== undefined) bal[uid] -= Number(amt); });
    });
    return bal;
  }, [expenses, usersArray]);

  const settlements = useMemo(() => {
    const debtors = [], creditors = [];
    Object.entries(balances).forEach(([uid, amt]) => {
      if (amt < -1) debtors.push({ uid, amt: Math.abs(amt) });
      else if (amt > 1) creditors.push({ uid, amt });
    });
    const txs = []; let i=0, j=0;
    while(i < debtors.length && j < creditors.length) {
      const amt = Math.min(debtors[i].amt, creditors[j].amt);
      txs.push({ from: debtors[i].uid, to: creditors[j].uid, amount: Math.round(amt) });
      debtors[i].amt -= amt; creditors[j].amt -= amt;
      if (debtors[i].amt < 1) i++; if (creditors[j].amt < 1) j++;
    }
    return txs;
  }, [balances]);

  const myBal = balances[currentUser.uid] || 0;

  return (
    <div className="p-5 space-y-6 animate-in slide-in-from-left-8 overflow-y-auto">
      <div className="flex items-center"><button onClick={onBack} className="p-1"><ChevronLeft size={24}/></button><h2 className="text-xl font-black ml-1">結算帳務</h2></div>
      
      <div className={`p-6 rounded-[32px] text-white shadow-lg ${myBal >= 0 ? 'bg-[#88d8c0]' : 'bg-[#f4a28c]'}`}>
        <p className="text-[10px] uppercase opacity-70 tracking-widest">My Status</p>
        <div className="text-3xl font-black mt-1">{myBal > 0 ? '+' : ''}{Math.round(myBal)} 元</div>
        <p className="mt-3 font-bold bg-white/20 inline-block px-3 py-1 rounded-full text-[11px]">
          {myBal > 0 ? '別人要給你 💎' : myBal < 0 ? '你要給別人 💸' : '互不相欠 ✨'}
        </p>
      </div>

      <div className="space-y-3 pb-6">
        {settlements.length === 0 ? (
          <div className="bg-white p-8 rounded-[28px] text-center text-gray-300 font-bold border-2 border-dashed border-gray-100 text-sm">結清囉！</div>
        ) : (
          settlements.map((s, idx) => (
            <div key={idx} className="bg-white p-5 rounded-[24px] shadow-sm border border-gray-50 flex items-center justify-between">
              <div className="flex flex-col items-center flex-1">
                <div className="text-2xl mb-1">{roomData.users[s.from]?.avatar}</div>
                <div className="text-[10px] font-bold text-gray-500 truncate w-16 text-center">{roomData.users[s.from]?.name}</div>
              </div>
              <div className="flex-1 flex flex-col items-center px-1">
                 <span className="text-[9px] font-black text-[#88d8c0] uppercase mb-1 tracking-tighter">支付給</span>
                 <div className="flex items-center text-[#ff9a8b] font-black"><MoveRight size={20}/><span className="ml-1.5 text-base">${s.amount}</span></div>
              </div>
              <div className="flex flex-col items-center flex-1">
                <div className="text-2xl mb-1">{roomData.users[s.to]?.avatar}</div>
                <div className="text-[10px] font-bold text-gray-800 truncate w-16 text-center">{roomData.users[s.to]?.name}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function LoginView({ onLogin }) {
  return (
    <div className="h-screen bg-[#f0f9f6] flex flex-col items-center justify-center p-6">
      <div className="max-w-sm w-full bg-white p-10 rounded-[40px] shadow-2xl text-center space-y-8 animate-in zoom-in">
        <div className="flex justify-center"><div className="w-20 h-20 bg-[#88d8c0] rounded-3xl flex items-center justify-center shadow-lg transform rotate-12"><Gem size={40} className="text-white -rotate-12" /></div></div>
        <h1 className="text-3xl font-black text-gray-800">閃閃記帳</h1>
        <button onClick={onLogin} className="w-full py-4 rounded-2xl font-bold text-gray-700 bg-white border-2 border-gray-100 flex justify-center items-center gap-3 shadow-[0_5px_0_0_#f3f4f6] active:translate-y-[5px] active:shadow-none transition-all text-sm">Google 帳號登入</button>
      </div>
    </div>
  );
}