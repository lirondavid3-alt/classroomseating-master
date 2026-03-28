
import React, { useState, useEffect } from 'react';
import { listAllUsers, AdminUserRecord, saveUserCharts, loadUserProfile, updateUserAdminFields, deleteUserAccount } from '../../services/storageService';
import { Chart } from '../../types';
import { analyzeUserChartWithAI, AIDiagnosis } from '../../services/aiSupportService';

interface AdminPanelProps {
    onBack: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ onBack }) => {
    const [users, setUsers] = useState<AdminUserRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [updatingEmail, setUpdatingEmail] = useState<string | null>(null);
    
    // Debugging states
    const [selectedUserCharts, setSelectedUserCharts] = useState<{ email: string; charts: Chart[] } | null>(null);
    const [loadingCharts, setLoadingCharts] = useState(false);
    const [debuggingChart, setDebuggingChart] = useState<Chart | null>(null);
    const [problemDescription, setProblemDescription] = useState('');
    const [aiDiagnosis, setAiDiagnosis] = useState<AIDiagnosis | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const allUsers = await listAllUsers();
            setUsers(allUsers);
        } catch (error) {
            console.error("Failed to fetch users:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleInspectUser = async (email: string) => {
        setLoadingCharts(true);
        try {
            const profile = await loadUserProfile(email);
            setSelectedUserCharts({ email, charts: profile.charts });
        } catch (error) {
            console.error("Failed to load user charts:", error);
            alert("טעינת מפות המשתמש נכשלה");
        } finally {
            setLoadingCharts(false);
        }
    };

    const handleAnalyzeWithAI = async () => {
        if (!debuggingChart) return;
        setIsAnalyzing(true);
        try {
            const diagnosis = await analyzeUserChartWithAI(debuggingChart, problemDescription);
            setAiDiagnosis(diagnosis);
        } catch (error) {
            console.error("AI Analysis failed:", error);
            alert("אבחון ה-AI נכשל");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleApplyAIFix = async () => {
        if (!selectedUserCharts || !debuggingChart || !aiDiagnosis?.suggestedFixJson) return;
        
        try {
            const fixedChart = JSON.parse(aiDiagnosis.suggestedFixJson) as Chart;
            const updatedCharts = selectedUserCharts.charts.map(c => c.id === fixedChart.id ? fixedChart : c);
            
            await saveUserCharts(selectedUserCharts.email, updatedCharts);
            setSelectedUserCharts({ ...selectedUserCharts, charts: updatedCharts });
            setDebuggingChart(null);
            setAiDiagnosis(null);
            alert("התיקון הוחל בהצלחה!");
        } catch (error) {
            console.error("Failed to apply fix:", error);
            alert("החלת התיקון נכשלה");
        }
    };

    const handleUpdateUser = async (email: string, newCredits: number, newIsSubscribed: boolean, newRole: 'admin' | 'user', newIsFrozen: boolean) => {
        setUpdatingEmail(email);
        try {
            await updateUserAdminFields(email, newCredits, newIsSubscribed, newRole, newIsFrozen);
            
            // Update local state
            setUsers(prev => prev.map(u => 
                u.email === email ? { ...u, credits: newCredits, isSubscribed: newIsSubscribed, role: newRole, isFrozen: newIsFrozen } : u
            ));
        } catch (error) {
            console.error("Failed to update user:", error);
            alert("עדכון המשתמש נכשל");
        } finally {
            setUpdatingEmail(null);
        }
    };

    const handleDeleteUser = async (email: string) => {
        if (!window.confirm(`האם אתה בטוח שברצונך למחוק את המשתמש ${email}? פעולה זו אינה ניתנת לביטול!`)) {
            return;
        }

        setUpdatingEmail(email);
        try {
            await deleteUserAccount(email);
            setUsers(prev => prev.filter(u => u.email !== email));
            alert("המשתמש נמחק בהצלחה");
        } catch (error) {
            console.error("Failed to delete user:", error);
            alert("מחיקת המשתמש נכשלה");
        } finally {
            setUpdatingEmail(null);
        }
    };

    const filteredUsers = users.filter(u => 
        u.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full bg-slate-50 p-6 overflow-hidden" dir="rtl">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-slate-800">פאנל ניהול (Admin)</h2>
                    <p className="text-slate-500">ניהול משתמשים, קרדיטים ומנויים</p>
                </div>
                <button 
                    onClick={onBack}
                    className="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors"
                >
                    חזרה לאפליקציה
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-grow flex flex-col overflow-hidden">
                <div className="p-4 border-bottom bg-slate-50 flex gap-4">
                    <div className="relative flex-grow">
                        <input 
                            type="text" 
                            placeholder="חיפוש לפי אימייל..." 
                            className="w-full pl-4 pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute left-3 top-2.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <button 
                        onClick={fetchUsers}
                        className="bg-teal-500 text-white px-4 py-2 rounded-lg hover:bg-teal-600 transition-colors flex items-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        רענן
                    </button>
                </div>

                <div className="overflow-auto flex-grow">
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500"></div>
                        </div>
                    ) : (
                        <table className="w-full text-right border-collapse">
                            <thead className="bg-slate-50 sticky top-0 z-10">
                                <tr>
                                    <th className="p-4 border-b font-bold text-slate-700">אימייל</th>
                                    <th className="p-4 border-b font-bold text-slate-700">סטטוס</th>
                                    <th className="p-4 border-b font-bold text-slate-700">תפקיד</th>
                                    <th className="p-4 border-b font-bold text-slate-700">עדכון אחרון</th>
                                    <th className="p-4 border-b font-bold text-slate-700">פעולות</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.length > 0 ? (
                                    filteredUsers.map((user) => (
                                        <tr key={user.email} className="hover:bg-slate-50 transition-colors border-b last:border-0">
                                            <td className="p-4 text-slate-800 font-medium">{user.email}</td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${user.isFrozen ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                                    {user.isFrozen ? 'מוקפא' : 'פעיל'}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <select 
                                                    value={user.role}
                                                    onChange={(e) => setUsers(prev => prev.map(u => u.email === user.email ? { ...u, role: e.target.value as 'admin' | 'user' } : u))}
                                                    className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-teal-500"
                                                >
                                                    <option value="user">משתמש</option>
                                                    <option value="admin">אדמין</option>
                                                </select>
                                            </td>
                                            <td className="p-4 text-slate-500 text-sm">
                                                {user.lastUpdated ? new Date(user.lastUpdated).toLocaleDateString('he-IL', {
                                                    day: '2-digit',
                                                    month: '2-digit',
                                                    year: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                }) : 'לעולם לא'}
                                            </td>
                                            <td className="p-4">
                                                <div className="flex gap-2">
                                                    <button 
                                                        onClick={() => handleUpdateUser(user.email, user.credits, user.isSubscribed, user.role, user.isFrozen)}
                                                        disabled={updatingEmail === user.email}
                                                        className="bg-teal-500 text-white px-3 py-1 rounded hover:bg-teal-600 transition-colors disabled:opacity-50 text-sm font-bold"
                                                    >
                                                        {updatingEmail === user.email ? 'מעדכן...' : 'שמור'}
                                                    </button>
                                                    <button 
                                                        onClick={() => handleUpdateUser(user.email, user.credits, user.isSubscribed, user.role, !user.isFrozen)}
                                                        disabled={updatingEmail === user.email}
                                                        className={`${user.isFrozen ? 'bg-green-500 hover:bg-green-600' : 'bg-amber-500 hover:bg-amber-600'} text-white px-3 py-1 rounded transition-colors disabled:opacity-50 text-sm font-bold`}
                                                    >
                                                        {user.isFrozen ? 'הפשר' : 'הקפא'}
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteUser(user.email)}
                                                        disabled={updatingEmail === user.email}
                                                        className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 transition-colors disabled:opacity-50 text-sm font-bold"
                                                    >
                                                        מחק
                                                    </button>
                                                    <button 
                                                        onClick={() => handleInspectUser(user.email)}
                                                        className="bg-slate-100 text-slate-600 px-3 py-1 rounded hover:bg-slate-200 transition-colors text-sm font-bold"
                                                    >
                                                        בדוק מפות
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="p-12 text-center text-slate-400">
                                            לא נמצאו משתמשים
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* User Charts Inspection Modal */}
            {selectedUserCharts && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" dir="rtl">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
                        <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">מפות של: {selectedUserCharts.email}</h3>
                                <p className="text-sm text-slate-500">צפייה ואבחון תקלות</p>
                            </div>
                            <button onClick={() => setSelectedUserCharts(null)} className="text-slate-400 hover:text-slate-600">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-auto flex-grow">
                            {loadingCharts ? (
                                <div className="flex items-center justify-center h-32">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
                                </div>
                            ) : selectedUserCharts.charts.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {selectedUserCharts.charts.map(chart => (
                                        <div key={chart.id} className="border rounded-xl p-4 hover:border-teal-500 transition-colors flex justify-between items-center">
                                            <div>
                                                <h4 className="font-bold text-slate-800">{chart.className}</h4>
                                                <p className="text-xs text-slate-500">{new Date(chart.creationDate).toLocaleDateString('he-IL')}</p>
                                                <p className="text-xs text-slate-400">{chart.students.length} תלמידים | {chart.layoutType === 'rows' ? 'טורים' : 'קבוצות'}</p>
                                            </div>
                                            <button 
                                                onClick={() => { setDebuggingChart(chart); setAiDiagnosis(null); setProblemDescription(''); }}
                                                className="bg-amber-100 text-amber-700 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-amber-200 flex items-center gap-2"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                                </svg>
                                                אבחון AI
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-center text-slate-500 py-12">למשתמש זה אין מפות שמורות.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* AI Debugger Modal */}
            {debuggingChart && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[110] flex items-center justify-center p-4" dir="rtl">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
                        <div className="p-6 border-b flex justify-between items-center bg-amber-50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800">אבחון AI חכם</h3>
                                    <p className="text-sm text-slate-500">מנתח את המפה: {debuggingChart.className}</p>
                                </div>
                            </div>
                            <button onClick={() => setDebuggingChart(null)} className="text-slate-400 hover:text-slate-600">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-auto flex-grow space-y-6">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">תאר את הבעיה (מה המשתמש דיווח?):</label>
                                <textarea 
                                    className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-amber-500 outline-none h-24"
                                    placeholder="למשל: המפה לא נטענת, תלמיד נעלם, האפליקציה קורסת כשלוחצים על ערבוב..."
                                    value={problemDescription}
                                    onChange={(e) => setProblemDescription(e.target.value)}
                                ></textarea>
                            </div>

                            {!aiDiagnosis && (
                                <button 
                                    onClick={handleAnalyzeWithAI}
                                    disabled={isAnalyzing || !problemDescription}
                                    className="w-full py-4 bg-amber-500 text-white rounded-xl font-bold text-lg hover:bg-amber-600 shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50"
                                >
                                    {isAnalyzing ? 'מנתח נתונים...' : 'התחל אבחון AI'}
                                </button>
                            )}

                            {aiDiagnosis && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                                        <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            אבחון ה-AI:
                                        </h4>
                                        <p className="text-slate-700 leading-relaxed">{aiDiagnosis.diagnosis}</p>
                                    </div>

                                    {aiDiagnosis.isCodeBug ? (
                                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
                                            <h4 className="font-bold text-rose-800 mb-2 flex items-center gap-2">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                </svg>
                                                זהו באג בקוד האפליקציה!
                                            </h4>
                                            <p className="text-rose-700 text-sm mb-4">ה-AI זיהה שהבעיה היא לוגית ולא בנתונים. העתק את הדו"ח הבא ושלח אותו למפתח:</p>
                                            <pre className="bg-white/50 p-3 rounded border border-rose-200 text-xs font-mono overflow-auto max-h-40">
                                                {aiDiagnosis.technicalReport}
                                            </pre>
                                        </div>
                                    ) : aiDiagnosis.suggestedFixJson ? (
                                        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
                                            <h4 className="font-bold text-teal-800 mb-2 flex items-center gap-2">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                                </svg>
                                                נמצא תיקון לנתונים!
                                            </h4>
                                            <p className="text-teal-700 text-sm mb-4">ה-AI יצר גרסה מתוקנת של המפה שתפתור את הבעיה עבור המשתמש.</p>
                                            <button 
                                                onClick={handleApplyAIFix}
                                                className="w-full py-3 bg-teal-500 text-white rounded-lg font-bold hover:bg-teal-600 transition-all"
                                            >
                                                החל תיקון AI על נתוני המשתמש
                                            </button>
                                        </div>
                                    ) : null}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPanel;
