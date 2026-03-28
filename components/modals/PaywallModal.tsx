
import React from 'react';
import { User } from '../../types';

interface PaywallModalProps {
    user: User;
    onClose: () => void;
}

const PaywallModal: React.FC<PaywallModalProps> = ({ user, onClose }) => {
    const [selectedPlan, setSelectedPlan] = React.useState<'monthly' | '3months' | '6months' | 'yearly'>('yearly');
    const [copied, setCopied] = React.useState(false);
    
    const phoneNumber = "0509133365"; 
    const displayPhone = "050-9133365";
    
    const handleCopy = () => {
        navigator.clipboard.writeText(phoneNumber);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    
    interface Plan {
        name: string;
        price: string;
        label: string;
        save: string | null;
        popular?: boolean;
    }

    const plans: Record<'monthly' | '3months' | '6months' | 'yearly', Plan> = {
        monthly: { name: 'חודש אחד', price: '19', label: 'לחודש', save: null },
        '3months': { name: '3 חודשים', price: '45', label: 'סה"כ', save: '21%' },
        '6months': { name: '6 חודשים', price: '75', label: 'סה"כ', save: '34%' },
        yearly: { name: 'שנה שלמה', price: '120', label: 'סה"כ', save: '47%', popular: true },
    };

    const bitLink = `https://bitpay.co.il/app/share-me?id=${phoneNumber}`;
    const payboxLink = `https://payboxapp.page.link/share?id=${phoneNumber}`;
    const whatsappLink = `https://wa.me/972${phoneNumber.substring(1)}?text=${encodeURIComponent(`היי לירן, העברתי תשלום עבור חבילת "${plans[selectedPlan].name}" (בעלות ${plans[selectedPlan].price}₪) לאפליקציית Classroom Seating Master. האימייל שלי הוא: ${user.email}`)}`;

    return (
        <div 
            className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] overflow-y-auto cursor-pointer p-4 md:p-8 flex justify-center" 
            dir="rtl"
            onClick={onClose}
        >
            <div 
                className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-300 cursor-default my-auto relative"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close Button */}
                <button 
                    onClick={onClose}
                    className="absolute top-4 left-4 z-10 bg-black/10 hover:bg-black/20 text-white p-2 rounded-full transition-all active:scale-90"
                    title="סגור וחזור"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                <div className="bg-gradient-to-br from-teal-500 via-teal-600 to-emerald-700 p-8 text-white text-center">
                    <div className="bg-white/20 w-16 h-16 rounded-2xl rotate-3 flex items-center justify-center mx-auto mb-4 backdrop-blur-sm border border-white/30">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 -rotate-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-black tracking-tight">שדרוג ל-Premium</h2>
                    <p className="text-teal-50 font-medium mt-1 opacity-90">פתחו את כל היכולות ללא הגבלה!</p>
                </div>

                <div className="p-6">
                    <p className="text-center text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">בחרו תוכנית:</p>
                    
                    <div className="grid grid-cols-1 gap-3 mb-8">
                        {(Object.entries(plans) as [keyof typeof plans, Plan][]).map(([id, plan]) => (
                            <button
                                key={id}
                                onClick={() => setSelectedPlan(id)}
                                className={`relative flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                                    selectedPlan === id 
                                    ? 'border-teal-500 bg-teal-50 shadow-md' 
                                    : 'border-slate-100 hover:border-slate-200 bg-white'
                                }`}
                            >
                                {plan.popular && (
                                    <span className="absolute -top-2.5 left-4 bg-amber-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm">
                                        הכי משתלם
                                    </span>
                                )}
                                <div className="flex items-center gap-3">
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                        selectedPlan === id ? 'border-teal-500 bg-teal-500' : 'border-slate-300'
                                    }`}>
                                        {selectedPlan === id && <div className="w-2 h-2 bg-white rounded-full" />}
                                    </div>
                                    <div className="text-right">
                                        <p className={`font-bold ${selectedPlan === id ? 'text-teal-900' : 'text-slate-700'}`}>{plan.name}</p>
                                        {plan.save && <p className="text-[10px] text-emerald-600 font-bold">חוסך {plan.save}</p>}
                                    </div>
                                </div>
                                <div className="text-left">
                                    <div className="flex items-baseline gap-0.5">
                                        <span className={`text-xl font-black ${selectedPlan === id ? 'text-teal-700' : 'text-slate-800'}`}>{plan.price}</span>
                                        <span className="text-xs font-bold text-slate-500">₪</span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-medium">{plan.label}</p>
                                </div>
                            </button>
                        ))}
                    </div>

                    <div className="space-y-6">
                        {/* Mobile Payment Option */}
                        <div className="bg-teal-50/50 p-4 rounded-2xl border border-teal-100 relative overflow-hidden">
                            <div className="absolute top-0 right-0 bg-teal-500 text-white text-[10px] px-2 py-0.5 rounded-bl-lg font-bold">
                                מומלץ לנייד
                            </div>
                            <p className="text-teal-900 font-bold text-sm mb-3 flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                                גולשים מהנייד? לחצו לתשלום:
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                <a 
                                    href={bitLink} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="flex flex-col items-center justify-center p-3 bg-white border-2 border-teal-100 rounded-xl hover:border-teal-500 hover:bg-teal-50 transition-all group shadow-sm"
                                >
                                    <span className="text-xl font-black text-blue-600 group-hover:scale-110 transition-transform">bit</span>
                                    <span className="text-[9px] font-bold text-slate-400 mt-1">פתיחה מהירה</span>
                                </a>
                                <a 
                                    href={payboxLink} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="flex flex-col items-center justify-center p-3 bg-white border-2 border-teal-100 rounded-xl hover:border-teal-500 hover:bg-teal-50 transition-all group shadow-sm"
                                >
                                    <span className="text-xl font-black text-blue-400 group-hover:scale-110 transition-transform">PayBox</span>
                                    <span className="text-[9px] font-bold text-slate-400 mt-1">פתיחה מהירה</span>
                                </a>
                            </div>
                        </div>

                        {/* Desktop Payment Option */}
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                            <p className="text-slate-700 font-bold text-sm mb-3 flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 21h6l-.75-4M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                גולשים מהמחשב? העתיקו ושלמו מהנייד:
                            </p>
                            <div className="bg-white rounded-xl p-3 flex items-center justify-between border border-slate-200 shadow-inner">
                                <div className="text-right">
                                    <p className="text-[9px] text-slate-400 font-bold uppercase">מספר להעברה</p>
                                    <p className="text-lg font-black text-slate-800 tracking-wider">{displayPhone}</p>
                                </div>
                                <button 
                                    onClick={handleCopy}
                                    className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all shadow-sm active:scale-95 flex items-center gap-1.5 ${
                                        copied 
                                        ? 'bg-emerald-500 text-white border-emerald-500' 
                                        : 'bg-white text-teal-600 border-teal-200 hover:bg-teal-50'
                                    } border`}
                                >
                                    {copied ? (
                                        <>
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                            הועתק!
                                        </>
                                    ) : (
                                        <>
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 00-2 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                            </svg>
                                            העתק מספר
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* WhatsApp Confirmation */}
                        <div className="pt-2">
                            <p className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">שלב אחרון: שלחו אישור תשלום</p>
                            <a 
                                href={whatsappLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full bg-emerald-500 text-white font-bold py-4 rounded-2xl hover:bg-emerald-600 transition-all flex items-center justify-center gap-3 shadow-xl shadow-emerald-200 active:scale-[0.98]"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.438 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                                </svg>
                                שלח אישור תשלום בוואטסאפ
                            </a>
                        </div>

                        <button 
                            onClick={onClose}
                            className="w-full text-slate-400 text-sm font-bold py-2 hover:text-teal-600 transition-colors uppercase tracking-widest"
                        >
                            חזרה לאפליקציה
                        </button>
                    </div>
                </div>

                <div className="bg-slate-50 p-6 text-center border-t border-slate-100">
                    <p className="text-xs text-slate-400 leading-relaxed">
                        השדרוג יבוצע ידנית על ידי המנהל לאחר קבלת האישור.
                        <br />
                        זמן טיפול ממוצע: עד 30 דקות.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PaywallModal;
