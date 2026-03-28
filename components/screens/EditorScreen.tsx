

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Chart, Student, RowsLayoutDetails, GeneratedRowsLayout, GroupsLayoutDetails, Constraints, GeneratedLayout, LevelConsiderationOptions } from '../../types';
import { generateId } from '../../utils';
import { DEFAULT_STUDENT_CONSTRAINTS, SUBJECTS, DEFAULT_ROWS_LAYOUT } from '../../constants';
import { PlusIcon, TrashIcon, PencilIcon, CheckIcon, XIcon, SparklesIcon, NoPreferenceIcon, BalancedIcon, PairingIcon, EdgesIcon } from '../icons';
import ClassroomPreview from '../chart/ClassroomPreview';
import StudentModal from '../modals/StudentModal';
import { generateLayout } from '../../services/layoutService';
import { getAIConstraintUpdates } from '../../services/aiService';

// --- START: NEW AI CHAT INTERFACE ---
interface ChatMessage {
    id: string;
    type: 'user' | 'ai-success' | 'ai-error';
    text: string;
    appliedUpdates?: { studentId: string; originalStudent: Student }[];
}

interface AIUpdateItem {
    studentName: string;
    academicLevel?: number;
    behaviorLevel?: number;
    constraints?: Partial<{
        sitWith: string[];
        dontSitWith: string[];
        allowedRows: number[] | null;
        allowedCols: number[] | null;
        allowedSeats: number[] | null;
        sitAlone: boolean;
    }>;
}

// Renamed interface to avoid any potential conflict or mis-inference with 'Student' type
interface StudentUpdateDraft {
    academicLevel?: number;
    behaviorLevel?: number;
    constraints?: Partial<Constraints>;
}

const AIConstraintAssistant: React.FC<{
    chart: Chart;
    setChart: (updater: React.SetStateAction<Chart | null>) => void;
}> = ({ chart, setChart }) => {
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [showHelp, setShowHelp] = useState(false);
    const noStudents = chart.students.length === 0;

    const handleApplySinglePrompt = async () => {
        if (!prompt.trim() || !chart || noStudents) return;
        
        const userMessage: ChatMessage = { id: generateId(), type: 'user', text: prompt };
        setChatHistory(prev => [...prev, userMessage]);
        setPrompt('');
        setIsLoading(true);

        try {
            const aiUpdates = await getAIConstraintUpdates(prompt, chart.students, chart.layoutType, chart.layoutDetails);

            if (!aiUpdates || !aiUpdates.updates || aiUpdates.updates.length === 0) {
                 const errorMessage: ChatMessage = { id: generateId(), type: 'ai-error', text: "הבקשה מכילה סתירה או שלא הצלחתי להבין אותה. אנא נסה/י לנסח מחדש ולשלוח בקשה אחת בכל פעם." };
                 setChatHistory(prev => [...prev, errorMessage]);
                 setIsLoading(false);
                 return;
            }

            const { students: currentStudents } = chart;
            const studentNameMap = new Map<string, Student>(currentStudents.map(s => [s.name.toLowerCase(), s]));

            const findStudentByName = (name: string): Student | undefined => {
                const lowercasedName = name.toLowerCase();
                const exactMatch = studentNameMap.get(lowercasedName);
                if (exactMatch) return exactMatch;

                const potentialMatches = currentStudents.filter(s => s.name.toLowerCase().includes(lowercasedName));
                if (potentialMatches.length === 1) return potentialMatches[0];

                return undefined;
            };
            
            // Explicitly typed student map
            const studentMap = new Map<string, Student>(currentStudents.map(s => [s.id, JSON.parse(JSON.stringify(s)) as Student]));
            
            const appliedUpdates: { studentId: string; originalStudent: Student }[] = [];
            const updatedStudentIds = new Set<string>();
            const unmappedNames = new Set<string>();

            // --- START: ROBUST PRE-APPLICATION VALIDATION ---
            // Use the new interface name to ensure type safety
            const proposedChanges = new Map<string, StudentUpdateDraft>();

            for (const update of aiUpdates.updates as AIUpdateItem[]) {
                if (!update.studentName) continue;

                const student = findStudentByName(update.studentName);
                if (!student) {
                    unmappedNames.add(update.studentName);
                    continue;
                }
                
                if (!proposedChanges.has(student.id)) {
                    // Explicitly type the initial object using the new interface
                    const initialChanges: StudentUpdateDraft = {};
                    proposedChanges.set(student.id, initialChanges);
                }
                const changes = proposedChanges.get(student.id)!;
                
                if (update.academicLevel) changes.academicLevel = update.academicLevel;
                if (update.behaviorLevel) changes.behaviorLevel = update.behaviorLevel;

                if (update.constraints) {
                    if (!changes.constraints) changes.constraints = {};
                    const { sitWith, dontSitWith, ...otherConstraints } = update.constraints;

                    if (sitWith) {
                        const sitWithIds = sitWith.map(name => findStudentByName(name)?.id).filter(Boolean) as string[];
                        changes.constraints.sitWith = [...new Set([...(changes.constraints.sitWith || []), ...sitWithIds])];
                    }
                    if (dontSitWith) {
                         const dontSitWithIds = dontSitWith.map(name => findStudentByName(name)?.id).filter(Boolean) as string[];
                        changes.constraints.dontSitWith = [...new Set([...(changes.constraints.dontSitWith || []), ...dontSitWithIds])];
                    }
                    
                    Object.assign(changes.constraints, otherConstraints);
                }
            }

            // Create a temporary "final state" map to validate against
            const finalStateMap = new Map<string, Student>(currentStudents.map(s => [s.id, JSON.parse(JSON.stringify(s)) as Student]));
            for (const [studentId, changes] of proposedChanges.entries()) {
                const studentToUpdate = finalStateMap.get(studentId)!;
                if (changes.academicLevel) studentToUpdate.academicLevel = changes.academicLevel;
                if (changes.behaviorLevel) studentToUpdate.behaviorLevel = changes.behaviorLevel;
                if (changes.constraints) {
                    studentToUpdate.constraints = { ...studentToUpdate.constraints, ...changes.constraints };
                }
            }
            
            // Validate the final proposed state for each student to prevent logical contradictions.
            for (const [studentId, student] of finalStateMap.entries()) {
                 const { constraints } = student;

                 // Conflict 1: Sit alone vs Sit with
                 if (constraints.sitAlone && constraints.sitWith && constraints.sitWith.length > 0) {
                    const partnerName = finalStateMap.get(constraints.sitWith[0])?.name || "another student";
                    const conflictMessage: ChatMessage = { 
                        id: generateId(), 
                        type: 'ai-error', 
                        text: `הבקשה שלך מכילה התנגשות: אי אפשר גם לבקש ש"${student.name}" ישב/תשב לבד וגם שישב/תשב עם "${partnerName}". לא בוצעו שינויים.` 
                    };
                    setChatHistory(prev => [...prev, conflictMessage]);
                    setIsLoading(false);
                    return; // ABORT all changes
                 }

                 // Conflict 2: Sit with vs Don't sit with (self)
                 if (constraints.sitWith && constraints.dontSitWith) {
                    const overlap = constraints.sitWith.filter(id => constraints.dontSitWith!.includes(id));
                    if (overlap.length > 0) {
                        const partnerName = finalStateMap.get(overlap[0])?.name || "another student";
                        const conflictMessage: ChatMessage = { 
                            id: generateId(), 
                            type: 'ai-error', 
                            text: `הבקשה שלך מכילה התנגשות: אי אפשר גם לבקש ש"${student.name}" ישב/תשב עם "${partnerName}" וגם לא ישב/תשב איתו/איתה. לא בוצעו שינויים.` 
                        };
                        setChatHistory(prev => [...prev, conflictMessage]);
                        setIsLoading(false);
                        return; // ABORT all changes
                    }
                }

                // Conflict 3: Symmetrical checks (cross-student)
                if (constraints.sitWith) {
                    for (const partnerId of constraints.sitWith) {
                        const partner = finalStateMap.get(partnerId);
                        if (partner) {
                            if (partner.constraints.sitAlone) {
                                const conflictMessage: ChatMessage = { 
                                    id: generateId(), 
                                    type: 'ai-error', 
                                    text: `התנגשות אילוצים: הגדרת ש"${student.name}" ישב/תשב עם "${partner.name}", אבל "${partner.name}" מוגדר/ת כ"חייב/ת לשבת לבד". לא בוצעו שינויים.` 
                                };
                                setChatHistory(prev => [...prev, conflictMessage]);
                                setIsLoading(false);
                                return;
                            }
                            if (partner.constraints.dontSitWith && partner.constraints.dontSitWith.includes(studentId)) {
                                const conflictMessage: ChatMessage = { 
                                    id: generateId(), 
                                    type: 'ai-error', 
                                    text: `התנגשות אילוצים: "${partner.name}" מוגדר/ת לא לשבת עם "${student.name}". לא ניתן לשמור את האילוץ ההפוך. לא בוצעו שינויים.` 
                                };
                                setChatHistory(prev => [...prev, conflictMessage]);
                                setIsLoading(false);
                                return;
                            }
                        }
                    }
                }
            }
            // --- END: ROBUST PRE-APPLICATION VALIDATION ---
            
            // If validation passes, apply the changes
            for (const [studentId, changes] of proposedChanges.entries()) {
                const studentToUpdate = studentMap.get(studentId)!;
                
                if (!updatedStudentIds.has(studentId)) {
                    appliedUpdates.push({ studentId: studentId, originalStudent: JSON.parse(JSON.stringify(studentToUpdate)) });
                }

                if (changes.academicLevel) studentToUpdate.academicLevel = changes.academicLevel;
                if (changes.behaviorLevel) studentToUpdate.behaviorLevel = changes.behaviorLevel;
                if (changes.constraints) {
                    studentToUpdate.constraints = { ...studentToUpdate.constraints, ...changes.constraints };
                }

                updatedStudentIds.add(studentId);
            }


            const nextStudentsState = Array.from(studentMap.values());
            
            let responseMessage: ChatMessage;

            if (updatedStudentIds.size > 0) {
                const updatedNames = Array.from(updatedStudentIds).map(id => studentMap.get(id)!.name);
                let text = `אוקיי, עדכנתי נתונים עבור: ${[...new Set(updatedNames)].join(', ')}`;
                if (unmappedNames.size > 0) {
                    text += `. לא הצלחתי לזהות את: ${Array.from(unmappedNames).join(', ')}.`;
                }
                responseMessage = {
                    id: generateId(),
                    type: 'ai-success',
                    text: text,
                    appliedUpdates: appliedUpdates
                };
            } else if (unmappedNames.size > 0) {
                responseMessage = { 
                    id: generateId(), 
                    type: 'ai-error', 
                    text: `לא הצלחתי לזהות את התלמידים: ${Array.from(unmappedNames).join(', ')}. ודא/י שהשם ברור וחד משמעי.` 
                };
            } else {
                responseMessage = { id: generateId(), type: 'ai-error', text: "לא הצלחתי להבין את הבקשה או שלא נמצאו תלמידים מתאימים. נסה/י לנסח מחדש." };
            }
            
            setChart(prevChart => prevChart ? { ...prevChart, students: nextStudentsState } : null);
            setChatHistory(prev => [...prev, responseMessage]);

        } catch (e) {
            console.error(e);
            const errorMessage: ChatMessage = { id: generateId(), type: 'ai-error', text: `אירעה שגיאה: ${e instanceof Error ? e.message : String(e)}` };
            setChatHistory(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleUndoUpdates = (messageId: string, updatesToUndo?: ChatMessage['appliedUpdates']) => {
        if (!updatesToUndo) return;

        setChart(prevChart => {
            if (!prevChart) return null;
            const studentMap = new Map(prevChart.students.map(s => [s.id, s]));
            updatesToUndo.forEach(({ studentId, originalStudent }) => {
                if (studentMap.has(studentId)) {
                    studentMap.set(studentId, originalStudent);
                }
            });
            return { ...prevChart, students: Array.from(studentMap.values()) };
        });

        setChatHistory(prev => prev.filter(msg => msg.id !== messageId));
    };
    
    const placeholderText = "לדוגמה: שדני ויעל ישבו יחד";

    return (
        <CollapsibleSection title="עוזר AI חכם" icon={<SparklesIcon className="h-5 w-5 text-purple-500" />}>
            <div className="p-2 space-y-3">
                 <div className="flex justify-between items-center">
                    <p className="text-sm font-semibold bg-amber-100 text-amber-800 p-2 rounded-md">הזן/י אילוץ אחד בכל פעם ולחץ/י 'שלח'.</p>
                    <button onClick={() => setShowHelp(!showHelp)} className="text-sm text-sky-600 hover:underline">
                        {showHelp ? 'הסתר הנחיות' : 'איך כותבים בקשות?'}
                    </button>
                </div>
                
                {showHelp && (
                    <div className="p-3 bg-sky-50 border border-sky-200 rounded-lg text-sm text-slate-700 space-y-2 animate-fade-in">
                        <h4 className="font-bold">כך תדברו עם העוזר החכם:</h4>
                        <ul className="list-disc list-inside space-y-1">
                            <li><span className="font-semibold">עיקרון מנחה:</span> בקשה אחת בכל פעם. אחרי כל בקשה, בדקו שהעוזר הבין אתכם נכון.</li>
                            <li><span className="font-semibold">השתמשו בשמות התלמידים</span> כפי שהם מופיעים ברשימה.</li>
                        </ul>
                        <h5 className="font-semibold pt-2">מילות מפתח מומלצות:</h5>
                        <ul className="space-y-1 text-xs">
                            <li><strong className="text-slate-800">לחיבור תלמידים:</strong> "ישבו יחד", "לשבץ את... עם...", "באותו שולחן". <br/><em>דוגמה: "שדני ויעל ישבו יחד"</em></li>
                            <li><strong className="text-slate-800">להפרדת תלמידים:</strong> "להפריד", "לא ליד", "לא באותו שולחן". <br/><em>דוגמה: "להפריד בין רון לגיל"</em></li>
                            <li><strong className="text-slate-800">למיקום בשורה:</strong> "שורה ראשונה", "מקדימה", "מאחורה", "לא בשורה 5". <br/><em>דוגמה: "שמאיה תשב בשורה הראשונה"</em></li>
                            <li><strong className="text-slate-800">למיקום בטור:</strong> "טור ימני", "טור 1", "ליד החלון". <br/><em>דוגמה: "שיוסי ישב בטור 3"</em></li>
                            <li><strong className="text-slate-800">לשבת לבד:</strong> "לבד", "שולחן נפרד", "לבודד". <br/><em>דוגמה: "שאור ישב לבד"</em></li>
                            <li><strong className="text-slate-800">לקביעת רמה לימודית:</strong> "תלמיד/ה חזק/ה", "חלש/ה", "מצטיין/ת". <br/><em>דוגמה: "שירי היא תלמידה חזקה"</em></li>
                            <li><strong className="text-slate-800">לקביעת רמת התנהגות:</strong> "מפריע/ה", "שקט/ה", "מאתגר/ת". <br/><em>דוגמה: "יונתן תלמיד מאתגר"</em></li>
                        </ul>
                         <p className="pt-2 text-slate-600"><strong>טיפ:</strong> הגדרת רמות התנהגות ולימוד תסייע לאסטרטגיות הסידור החכמות (כמו 'שכן חזק-חלש') לפעול בצורה מדויקת יותר.</p>
                    </div>
                )}

                <div className="bg-slate-50 border rounded-lg p-2 space-y-2 h-40 overflow-y-auto">
                    {noStudents && chatHistory.length === 0 && (
                        <div className="flex items-center justify-center h-full text-center text-slate-500 text-sm">
                            <p>יש להוסיף תלמידים לרשימה<br/>כדי להשתמש בעוזר ה-AI.</p>
                        </div>
                    )}
                    {chatHistory.map(msg => (
                        <div key={msg.id} className={`flex items-start gap-2 text-sm ${msg.type === 'user' ? 'justify-end' : 'items-center'}`}>
                            {msg.type.startsWith('ai') && <SparklesIcon className="h-4 w-4 text-purple-500 mt-1 shrink-0" />}
                            <div className={`p-2 rounded-lg max-w-[90%] ${
                                msg.type === 'user' ? 'bg-sky-100 text-sky-800' : 
                                msg.type === 'ai-success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                                {msg.text}
                            </div>
                             {msg.type === 'ai-success' && msg.appliedUpdates && (
                                <button 
                                    onClick={() => handleUndoUpdates(msg.id, msg.appliedUpdates)} 
                                    className="text-xs text-rose-600 hover:underline font-semibold"
                                    title="בטל פעולה"
                                >
                                    בטל
                                </button>
                            )}
                        </div>
                    ))}
                     {isLoading && (
                        <div className="flex items-center gap-2 text-sm">
                            <SparklesIcon className="h-4 w-4 text-purple-500 mt-1 shrink-0" />
                            <div className="p-2 rounded-lg bg-slate-100 text-slate-600">
                                <div className="flex items-center gap-2">
                                    <div className="animate-spin-fast rounded-full h-4 w-4 border-b-2 border-slate-500"></div>
                                    <span>חושב...</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <div className="flex">
                    <input 
                        value={prompt}
                        onChange={e => setPrompt(e.target.value)}
                        onKeyPress={e => e.key === 'Enter' && handleApplySinglePrompt()}
                        placeholder={noStudents ? "יש להוסיף תלמידים תחילה" : placeholderText}
                        className="flex-grow p-2 border rounded-r-md disabled:bg-slate-100"
                        disabled={isLoading || noStudents}
                    />
                    <button 
                        onClick={handleApplySinglePrompt}
                        disabled={isLoading || !prompt.trim() || noStudents}
                        className="bg-purple-500 text-white p-2 rounded-l-md hover:bg-purple-600 disabled:bg-purple-300 flex items-center justify-center gap-2 font-semibold"
                    >
                        שלח
                    </button>
                </div>
            </div>
        </CollapsibleSection>
    );
};

// --- END: NEW AI CHAT INTERFACE ---

const CollapsibleSection: React.FC<{ title: string; children: React.ReactNode; defaultOpen?: boolean; icon?: React.ReactNode }> = ({ title, children, defaultOpen = false, icon }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="border-b">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex justify-between items-center py-4 font-semibold text-lg text-slate-700"
            >
                <span className="flex items-center gap-2">
                    {icon}
                    <span>{title}</span>
                </span>
                <svg className={`w-5 h-5 transition-transform text-slate-500 ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            {isOpen && <div className="pb-4">{children}</div>}
        </div>
    );
};

// Helper function to check for non-default constraints
const hasConstraints = (student: Student): boolean => {
    const constraints = { ...DEFAULT_STUDENT_CONSTRAINTS, ...(student.constraints || {}) };
    return constraints.sitAlone ||
           (constraints.sitWith?.length ?? 0) > 0 ||
           (constraints.dontSitWith?.length ?? 0) > 0 ||
           (constraints.allowedRows?.length ?? 0) > 0 ||
           (constraints.allowedCols?.length ?? 0) > 0 ||
           (constraints.allowedSeats?.length ?? 0) > 0;
};

const LevelConsiderationSelector: React.FC<{
    selectedValues: LevelConsiderationOptions;
    onChange: (option: keyof LevelConsiderationOptions) => void;
}> = ({ selectedValues, onChange }) => {
    const options = [
        { value: 'balanced', label: 'פיזור מאוזן', description: 'פיזור מאוזן לפי שילוב רמה לימודית והתנהגות.', icon: <BalancedIcon /> },
        { value: 'strong_weak_neighbor', label: 'שכן חזק-חלש', description: 'הושבת תלמיד חזק ליד חלש ללמידת עמיתים.', icon: <PairingIcon /> },
        { value: 'challenge_at_edges', label: 'אתגר בקצוות', description: 'מיקום תלמידים מאתגרים בקצוות הכיתה.', icon: <EdgesIcon /> },
    ] as const;

    const noOptionsSelected = !Object.values(selectedValues).some(v => v);
    const selectedCount = Object.values(selectedValues).filter(v => v).length;

    return (
        <div className="col-span-2 mt-4">
            <label className="text-sm font-medium text-slate-600 mb-1 block">אסטרטגיות סידור חכמות (אופציונלי)</label>
            <p className="text-xs text-slate-500 mb-3">
                בחר/י אסטרטגיה אחת או יותר. המערכת תמיד תכבד את האילוצים הידניים, ותפעיל את האסטרטגיות על שאר התלמידים.
                {noOptionsSelected && <strong> כרגע, הסידור יתבצע לפי אילוצים בלבד.</strong>}
            </p>
            <div className="grid grid-cols-2 gap-2">
                {options.map(option => (
                    <button
                        key={option.value}
                        type="button"
                        onClick={() => onChange(option.value)}
                        className={`p-3 rounded-lg border-2 text-right transition-all ${selectedValues[option.value] ? 'bg-teal-50 border-teal-500 shadow-md' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}
                    >
                        <div className="flex items-center gap-3">
                            <div className={selectedValues[option.value] ? 'text-teal-600' : 'text-slate-500'}>{React.cloneElement(option.icon, { className: 'h-6 w-6' })}</div>
                            <div>
                                <h4 className="font-bold text-sm text-slate-800">{option.label}</h4>
                                <p className="text-xs text-slate-500">{option.description}</p>
                            </div>
                        </div>
                    </button>
                ))}
            </div>
            {selectedCount > 1 && (
                <div className="mt-3 p-3 bg-teal-50 border border-teal-200 rounded-lg text-sm text-teal-800 animate-fade-in">
                    <h5 className="font-bold flex items-center gap-1.5"><SparklesIcon className="h-4 w-4" /> שילוב חכם</h5>
                    <p className="mt-1">המערכת תשלב את הבחירות שלך בצורה אופטימלית. לדוגמה, בבחירת 'שכן חזק-חלש' ו'אתגר בקצוות', המערכת תיתן עדיפות לשיבוץ זוגות של תלמידים חזקים עם תלמידים חלשים-מאתגרים בקצוות הכיתה.</p>
                </div>
            )}
        </div>
    );
};

const RowsSettings: React.FC<{
    layoutDetails: RowsLayoutDetails;
    onLayoutDetailsChange: (newDetails: Partial<RowsLayoutDetails>) => void;
    handleLevelConsiderationChange: (option: keyof LevelConsiderationOptions) => void;
}> = ({ layoutDetails, onLayoutDetailsChange, handleLevelConsiderationChange }) => {
    
    const { columnConfiguration = [5, 5, 5, 5] } = layoutDetails;
    const numCols = columnConfiguration.length;

    const handleNumColsChange = (newNumCols: number) => {
        if (newNumCols < 1 || newNumCols > 10 || !Number.isInteger(newNumCols)) return;
        const currentAvgRows = columnConfiguration.length > 0
            ? Math.round(columnConfiguration.reduce((a, b) => a + b, 0) / columnConfiguration.length)
            : 5;

        const newConfig = Array(newNumCols).fill(Math.max(1, currentAvgRows));
        onLayoutDetailsChange({ columnConfiguration: newConfig });
    };

    const handleRowsInColChange = (colIndex: number, numRows: number) => {
        if (numRows < 0 || numRows > 15 || !Number.isInteger(numRows)) return;
        const newConfig = [...columnConfiguration];
        newConfig[colIndex] = numRows;
        onLayoutDetailsChange({ columnConfiguration: newConfig });
    };

    const handleGenericChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        onLayoutDetailsChange({ [e.target.name]: e.target.value });
    };

    return (
        <div>
            <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                    <label className="text-sm font-medium text-slate-600">מספר טורים</label>
                    <input 
                        type="number" 
                        value={numCols} 
                        onChange={(e) => handleNumColsChange(parseInt(e.target.value, 10))} 
                        min="1" max="10"
                        className="w-full mt-1 p-2 border rounded-md"
                    />
                </div>
                <div className="col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-2 border-t pt-4">
                    {columnConfiguration.map((rows, index) => (
                        <div key={index}>
                            <label className="text-xs font-medium text-slate-500">שולחנות בטור {index + 1}</label>
                            <input 
                                type="number" 
                                value={rows} 
                                onChange={(e) => handleRowsInColChange(index, parseInt(e.target.value, 10))} 
                                min="0" max="15"
                                className="w-full mt-1 p-2 border rounded-md"
                            />
                        </div>
                    ))}
                </div>
                <div>
                    <label className="text-sm font-medium text-slate-600">שולחן מורה</label>
                    <select name="teacherDeskPosition" value={layoutDetails.teacherDeskPosition} onChange={handleGenericChange} className="w-full mt-1 p-2 border rounded-md bg-white">
                        <option value="top">למעלה</option>
                        <option value="bottom">למטה</option>
                    </select>
                </div>
                <div>
                    <label className="text-sm font-medium text-slate-600">חלונות</label>
                    <select name="windowPosition" value={layoutDetails.windowPosition} onChange={handleGenericChange} className="w-full mt-1 p-2 border rounded-md bg-white">
                        <option value="left">שמאל</option>
                        <option value="right">ימין</option>
                    </select>
                </div>
                <div>
                    <label className="text-sm font-medium text-slate-600">דלת</label>
                    <select name="doorPosition" value={layoutDetails.doorPosition} onChange={handleGenericChange} className="w-full mt-1 p-2 border rounded-md bg-white">
                        <option value="left">שמאל</option>
                        <option value="right">ימין</option>
                    </select>
                </div>
                <div>
                    <label className="text-sm font-medium text-slate-600">סידור לפי מגדר</label>
                    <select name="genderArrangement" value={layoutDetails.genderArrangement || 'gender_random'} onChange={handleGenericChange} className="w-full mt-1 p-2 border rounded-md bg-white">
                        <option value="gender_random">ללא העדפה</option>
                        <option value="gender_mixed">בן ליד בת</option>
                        <option value="gender_same">בן ליד בן, בת ליד בת</option>
                    </select>
                </div>
            </div>
            <LevelConsiderationSelector 
                selectedValues={layoutDetails.levelConsideration || DEFAULT_ROWS_LAYOUT.levelConsideration!}
                onChange={handleLevelConsiderationChange}
            />
        </div>
    );
};


const GroupsSettings: React.FC<{
    layoutDetails: GroupsLayoutDetails;
    handleDetailChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
    groupingMethod: string;
    setGroupingMethod: (method: string) => void;
}> = ({ layoutDetails, handleDetailChange, groupingMethod, setGroupingMethod }) => (
    <div className="space-y-4">
        <div>
            <label className="text-sm font-medium text-slate-600">מספר קבוצות</label>
            <input type="number" name="groups" value={layoutDetails.groups} onChange={handleDetailChange} min="1" className="w-full mt-1 p-2 border rounded-md"/>
        </div>
        <div>
            <label className="text-sm font-medium text-slate-600">שיטת חלוקה</label>
            <select name="groupingMethod" value={groupingMethod} onChange={(e) => setGroupingMethod(e.target.value)} className="w-full mt-1 p-2 border rounded-md bg-white">
                <option value="random">אקראית</option>
                <option value="gender">איזון מגדרי</option>
                <option value="separate_genders">קבוצות נפרדות (בנים/בנות)</option>
                <option value="same_level">קבוצות הומוגניות (רמה לימודית)</option>
                <option value="heterogeneous">קבוצות הטרוגניות (רמה לימודית)</option>
                <option value="same_behavior">קבוצות הומוגניות (התנהגות)</option>
                <option value="heterogeneous_behavior">קבוצות הטרוגניות (התנהגות)</option>
                <option value="heterogeneous_combined">קבוצות הטרוגניות (משולב לימודים והתנהגות)</option>
            </select>
        </div>
        {(groupingMethod === 'same_level' || groupingMethod === 'heterogeneous') && (
            <div className="p-3 bg-slate-50 rounded-md">
                <p className="text-sm text-slate-600">החלוקה תתבסס על 'רמת הלימוד' שהוגדרה לכל תלמיד.</p>
            </div>
        )}
        {(groupingMethod === 'same_behavior' || groupingMethod === 'heterogeneous_behavior') && (
            <div className="p-3 bg-slate-50 rounded-md">
                <p className="text-sm text-slate-600">החלוקה תתבסס על 'התנהגות' שהוגדרה לכל תלמיד.</p>
            </div>
        )}
        {groupingMethod === 'heterogeneous_combined' && (
            <div className="p-3 bg-slate-50 rounded-md">
                <p className="text-sm text-slate-600">החלוקה תנסה ליצור קבוצות מאוזנות ככל הניתן, הן מבחינת רמת הלימוד והן מבחינת ההתנהגות.</p>
            </div>
        )}
    </div>
);

interface EditorScreenProps {
    chart: Chart;
    setChart: (updater: React.SetStateAction<Chart | null>) => void;
    onGenerate: (chart: Chart, layout?: GeneratedLayout | null) => void;
    groupingMethod: string;
    setGroupingMethod: (method: string) => void;
}

const EditorScreen: React.FC<EditorScreenProps> = ({ 
    chart, setChart, onGenerate, 
    groupingMethod, setGroupingMethod
}) => {
    const [addMode, setAddMode] = useState<'list' | 'single'>('list');
    const [singleStudentName, setSingleStudentName] = useState('');
    const [studentList, setStudentList] = useState('');
    const [studentToEdit, setStudentToEdit] = useState<Student | null>(null);
    const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
    const [editedStudentName, setEditedStudentName] = useState('');

    const { fullLayout, previewLayout } = useMemo(() => {
        if (chart.layoutType !== 'rows') {
            return { fullLayout: null, previewLayout: null };
        }

        // Always generate the full layout based on the current chart state.
        // This is the source of truth for what the user sees in preview and what they will get.
        const layout = generateLayout({ ...chart, generatedLayout: null }, '') as GeneratedRowsLayout;

        // The preview itself is a filtered view of the full layout, showing only constrained students.
        const constrainedStudentNames = new Set(chart.students.filter(hasConstraints).map(s => s.name));
        
        if (constrainedStudentNames.size === 0) {
            // If no students have constraints, the preview is empty, but we still have the full layout ready.
            return { fullLayout: layout, previewLayout: { desks: [], unplacedStudents: [] } };
        }
        
        const filteredDesks = layout.desks.map(desk => ({
            ...desk,
            students: desk.students.filter(s => constrainedStudentNames.has(s.name))
        }));
        const filteredUnplaced = layout.unplacedStudents.filter(s => constrainedStudentNames.has(s.name));

        return { 
            fullLayout: layout, 
            previewLayout: { desks: filteredDesks, unplacedStudents: filteredUnplaced } 
        };
    }, [chart]);

    const constrainedStudentsExist = useMemo(() => chart.students.some(hasConstraints), [chart.students]);

    const handleLayoutDetailsChange = (updates: Partial<RowsLayoutDetails>) => {
        setChart(prev => prev ? {
            ...prev,
            layoutDetails: { ...prev.layoutDetails, ...updates }
        } : null);
    };

    const handleGroupsDetailChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const processedValue = e.target.type === 'number' ? parseInt(value, 10) || 0 : value;
        setChart(prev => prev ? {
            ...prev,
            layoutDetails: { ...prev.layoutDetails, [name]: processedValue }
        } : null);
    };
    
    const handleLevelConsiderationChange = (option: keyof LevelConsiderationOptions) => {
        setChart(prev => {
            if (!prev || prev.layoutType !== 'rows') return prev;
            const currentOptions = (prev.layoutDetails as RowsLayoutDetails).levelConsideration || { ...DEFAULT_ROWS_LAYOUT.levelConsideration! };
            const newOptions = {
                ...currentOptions,
                [option]: !currentOptions[option],
            };
            return {
                ...prev,
                layoutDetails: { ...prev.layoutDetails, levelConsideration: newOptions }
            };
        });
    };

    const parseNameAndGender = (nameInput: string): { name: string; gender: '' | 'זכר' | 'נקבה' } => {
        const trimmedInput = nameInput.trim();
        
        // Match name ending with one or more spaces, then 'ז' or 'נ'
        const match = trimmedInput.match(/^(.*)\s+([זנ])$/);
        
        if (match) {
            const name = match[1].trim();
            const genderChar = match[2];
            const gender = genderChar === 'ז' ? 'זכר' : 'נקבה';
            return { name, gender };
        }
        
        return { name: trimmedInput, gender: '' };
    };
    
    const handleAddSingleStudent = () => {
        const { name, gender } = parseNameAndGender(singleStudentName);
        if (!name || chart.students.some(s => s.name.toLowerCase() === name.toLowerCase())) return;
        const newStudent: Student = { id: generateId(), name, gender, ratings: {}, constraints: { ...DEFAULT_STUDENT_CONSTRAINTS } };
        setChart(prev => prev ? { ...prev, students: [...prev.students, newStudent] } : null);
        setSingleStudentName('');
    };
    
    const handleAddListStudents = () => {
        const lines = studentList.split('\n').map(n => n.trim()).filter(Boolean);
        const existingNames = new Set(chart.students.map(s => s.name.toLowerCase()));
        const newStudents = lines.map(parseNameAndGender).filter(({ name }) => name && !existingNames.has(name.toLowerCase())).map(({ name, gender }) => ({ id: generateId(), name, gender, ratings: {}, constraints: { ...DEFAULT_STUDENT_CONSTRAINTS } }));
        setChart(prev => prev ? { ...prev, students: [...prev.students, ...newStudents] } : null);
        setStudentList('');
    };

    const handleRemoveStudent = (id: string) => {
        setChart(prev => prev ? { ...prev, students: prev.students.filter(s => s.id !== id) } : null);
    };

    const handleSaveStudent = (updatedStudent: Student) => {
        setChart(prev => {
            if (!prev) return null;
    
            const originalStudent = prev.students.find(s => s.id === updatedStudent.id);
            if (!originalStudent) return prev;
    
            // FIX: Explicitly type the newStudents map to ensure values are treated as Student objects, resolving 'unknown' type errors on 'partner.constraints'.
            const newStudents: Map<string, Student> = new Map(prev.students.map(s => [s.id, JSON.parse(JSON.stringify(s)) as Student]));
            newStudents.set(updatedStudent.id, updatedStudent);
    
            const updateSymmetric = (key: 'sitWith' | 'dontSitWith', original: Student, updated: Student) => {
                const originalSet = new Set(original.constraints[key] || []);
                const updatedSet = new Set(updated.constraints[key] || []);
    
                for (const partnerId of updatedSet) {
                    if (!originalSet.has(partnerId)) {
                        const partner = newStudents.get(partnerId);
                        if (partner) {
                            const partnerConstraints = partner.constraints || { ...DEFAULT_STUDENT_CONSTRAINTS };
                            const partnerSet = new Set(partnerConstraints[key] || []);
                            partnerSet.add(updated.id);
                            partner.constraints = { ...partnerConstraints, [key]: Array.from(partnerSet) };
                        }
                    }
                }
    
                for (const partnerId of originalSet) {
                    if (!updatedSet.has(partnerId)) {
                        const partner = newStudents.get(partnerId);
                        if (partner) {
                            const partnerConstraints = partner.constraints || { ...DEFAULT_STUDENT_CONSTRAINTS };
                            const partnerSet = new Set(partnerConstraints[key] || []);
                            partnerSet.delete(updated.id);
                            partner.constraints = { ...partnerConstraints, [key]: Array.from(partnerSet) };
                        }
                    }
                }
            };
            
            updateSymmetric('sitWith', originalStudent, updatedStudent);
            updateSymmetric('dontSitWith', originalStudent, updatedStudent);
            
            return { ...prev, students: Array.from(newStudents.values()) };
        });
        setStudentToEdit(null);
    };

    const handleStartEditName = (student: Student) => {
        setEditingStudentId(student.id);
        const genderSuffix = student.gender === 'זכר' ? ' ז' : student.gender === 'נקבה' ? ' נ' : '';
        setEditedStudentName(student.name + genderSuffix);
    };

    const handleSaveStudentName = () => {
        if (!editingStudentId) return;

        const { name: newName, gender: newGender } = parseNameAndGender(editedStudentName);

        if (!newName) {
            alert('שם התלמיד לא יכול להיות ריק.');
            return;
        }

        const isDuplicate = chart.students.some(s => s.name.toLowerCase() === newName.toLowerCase() && s.id !== editingStudentId);
        if (isDuplicate) {
            alert('שם תלמיד זה כבר קיים ברשימה.');
            return;
        }

        setChart(prev => {
            if (!prev) return null;
            const updatedStudents = prev.students.map(s => 
                s.id === editingStudentId 
                    ? { ...s, name: newName, gender: newGender || s.gender } 
                    : s
            );
            return { ...prev, students: updatedStudents };
        });
        setEditingStudentId(null);
    };

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const totalSeats = useMemo(() => {
        if (chart.layoutType === 'rows') {
            const { columnConfiguration = [] } = (chart.layoutDetails as RowsLayoutDetails);
            return columnConfiguration.reduce((a, b) => a + b, 0) * 2;
        }
        return 0;
    }, [chart.layoutType, chart.layoutDetails]);

    const studentCount = chart.students.length;
    const hasEnoughSeats = totalSeats >= studentCount;

    return (
        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden relative">
            {/* Mobile Sidebar Toggle */}
            <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="lg:hidden fixed bottom-6 left-6 z-50 p-4 bg-sky-500 text-white rounded-full shadow-2xl hover:bg-sky-600 transition-all active:scale-95"
            >
                {isSidebarOpen ? <XIcon className="h-6 w-6" /> : <PencilIcon className="h-6 w-6" />}
            </button>

            <main className="flex-1 h-full bg-slate-100 p-4 md:p-8 overflow-auto flex items-center justify-center relative">
                 {chart.layoutType === 'rows' ? (
                    <div className="text-center">
                        {constrainedStudentsExist && <h4 className="text-lg font-bold text-teal-600 mb-2">תצוגה מקדימה (אילוצים בלבד)</h4>}
                        <ClassroomPreview 
                            layoutDetails={chart.layoutDetails as RowsLayoutDetails}
                            generatedLayout={previewLayout}
                        />
                        {!constrainedStudentsExist && <p className="mt-4 text-slate-500">הגדר/י אילוצים כדי לראות תצוגה מקדימה של השיבוץ.</p>}
                    </div>
                ) : (
                    <div className="text-center text-slate-500 p-10 bg-white rounded-lg shadow-md">
                        <h2 className="text-2xl font-bold text-teal-600 mb-4">חלוקה לקבוצות</h2>
                        <p>התחל/י בהגדרת מספר הקבוצות ושיטת החלוקה בצד, ולאחר מכן הוסף/י תלמידים.</p>
                    </div>
                )}
            </main>
            <aside className={`
                fixed inset-0 z-40 lg:relative lg:inset-auto
                w-full lg:w-[420px] bg-white h-full flex flex-col shadow-2xl lg:shadow-none border-l border-slate-200
                transition-transform duration-300 ease-in-out
                ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
            `}>
                <div className="flex-grow p-6 overflow-y-auto">
                    <div className="space-y-6">
                         <div>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-semibold text-lg text-slate-700">
                                   {chart.layoutType === 'rows' ? 'הגדרות מפה' : 'הגדרות קבוצות'}
                                </h3>
                                {chart.layoutType === 'rows' && (
                                    <div className={`px-2 py-1 rounded text-xs font-bold ${hasEnoughSeats ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                        {studentCount} / {totalSeats} מקומות
                                    </div>
                                )}
                            </div>
                            {chart.layoutType === 'rows' ? (
                                <RowsSettings 
                                    layoutDetails={chart.layoutDetails as RowsLayoutDetails} 
                                    onLayoutDetailsChange={handleLayoutDetailsChange} 
                                    handleLevelConsiderationChange={handleLevelConsiderationChange}
                                />
                            ) : (
                                <GroupsSettings 
                                    layoutDetails={chart.layoutDetails as GroupsLayoutDetails} 
                                    handleDetailChange={handleGroupsDetailChange} 
                                    groupingMethod={groupingMethod}
                                    setGroupingMethod={setGroupingMethod}
                                />
                            )}
                         </div>
                         <CollapsibleSection title={`רשימת תלמידים (${chart.students.length})`} defaultOpen>
                            <div className="space-y-4">
                                <AIConstraintAssistant chart={chart} setChart={setChart} />
                                <div className="flex border rounded-md overflow-hidden">
                                    <button onClick={() => setAddMode('list')} className={`py-2 px-4 text-sm font-semibold flex-1 ${addMode === 'list' ? 'bg-teal-50 text-teal-700' : 'text-slate-500 bg-slate-50'}`}>מרשימה</button>
                                    <button onClick={() => setAddMode('single')} className={`py-2 px-4 text-sm font-semibold flex-1 border-r ${addMode === 'single' ? 'bg-teal-50 text-teal-700' : 'text-slate-500 bg-slate-50'}`}>תלמיד בודד</button>
                                </div>
                                {addMode === 'single' ? (
                                    <div className="flex">
                                        <input type="text" value={singleStudentName} onChange={e => setSingleStudentName(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleAddSingleStudent()} placeholder="שם תלמיד/ה (למשל: דני ז)" className="flex-grow p-2 border rounded-r-md" />
                                        <button onClick={handleAddSingleStudent} className="bg-teal-500 text-white p-2 rounded-l-md hover:bg-teal-600 flex items-center"><PlusIcon className="h-5 w-5"/></button>
                                    </div>
                                ) : (
                                    <div>
                                        <textarea value={studentList} onChange={e => setStudentList(e.target.value)} placeholder="הדבק רשימה, שם בשורה. הוסף ' ז' או ' נ' למין." className="w-full p-2 border rounded-md h-24 mb-2"></textarea>
                                        <button onClick={handleAddListStudents} className="w-full bg-teal-500 text-white p-2 rounded-md hover:bg-teal-600 flex items-center justify-center gap-2 font-semibold"><PlusIcon className="h-5 w-5"/> הוסף רשימה</button>
                                    </div>
                                )}
                                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                {chart.students.map(student => (
                                    <div key={student.id} className="flex items-center justify-between p-2 rounded-md hover:bg-slate-50 group">
                                        {editingStudentId === student.id ? (
                                            <>
                                                <input
                                                    type="text"
                                                    value={editedStudentName}
                                                    onChange={(e) => setEditedStudentName(e.target.value)}
                                                    onKeyPress={e => e.key === 'Enter' && handleSaveStudentName()}
                                                    onBlur={handleSaveStudentName}
                                                    autoFocus
                                                    className="flex-grow p-1 border rounded-md"
                                                />
                                                <div className="flex items-center">
                                                    <button onClick={handleSaveStudentName} className="p-1 text-green-500 hover:text-green-700"><CheckIcon /></button>
                                                    <button onClick={() => setEditingStudentId(null)} className="p-1 text-red-500 hover:text-red-700"><XIcon /></button>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <button onClick={() => setStudentToEdit(student)} className="text-right flex-grow flex items-center justify-end">
                                                    <span className={`font-medium ${student.gender === 'זכר' ? 'text-sky-600' : student.gender === 'נקבה' ? 'text-pink-500' : 'text-slate-800'}`}>{student.name}</span>
                                                    {student.gender && <span className={`text-xs mr-2 ${student.gender === 'זכר' ? 'text-sky-400' : 'text-pink-400'}`}>{`(${student.gender === 'זכר' ? 'ז' : 'נ'})`}</span>}
                                                </button>
                                                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleStartEditName(student)} className="p-1 text-slate-400 hover:text-sky-500" title="ערוך שם">
                                                        <PencilIcon />
                                                    </button>
                                                    <button onClick={(e) => { e.stopPropagation(); handleRemoveStudent(student.id); }} className="p-1 text-slate-400 hover:text-rose-500" title="מחק תלמיד">
                                                        <TrashIcon />
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))}
                                </div>
                            </div>
                        </CollapsibleSection>
                    </div>
                </div>
                <div className="p-6 border-t mt-auto bg-white">
                    <button onClick={() => onGenerate(chart, chart.layoutType === 'rows' ? fullLayout : null)} className="w-full py-3 bg-teal-500 text-white rounded-lg hover:bg-teal-600 font-bold text-lg shadow-lg hover:shadow-xl transition-all">
                        {chart.layoutType === 'rows' ? 'צור מפת כיתה' : 'צור קבוצות'}
                    </button>
                </div>
            </aside>
             {studentToEdit && (
                <StudentModal 
                    student={studentToEdit}
                    chart={chart}
                    onClose={() => setStudentToEdit(null)}
                    onSave={handleSaveStudent}
                />
            )}
        </div>
    );
};

export default EditorScreen;