
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Chart, User, Screen, LayoutDetails, GeneratedRowsLayout, Desk, RowsLayoutDetails, UnplacedStudentInfo, Student, GeneratedLayout } from './types';
import { loadUserProfile, saveUserCharts, updateUserAdminFields, handleFirestoreError, OperationType } from './services/storageService';
import { generateLayout } from './services/layoutService';
import { auth, db } from './services/firebase';
import { onAuthStateChanged, signOut } from "firebase/auth";
import { onSnapshot, doc, getDocFromCache, getDocFromServer } from "firebase/firestore";
import LoginScreen from './components/screens/LoginScreen';
import MainScreen from './components/screens/MainScreen';
import EditorScreen from './components/screens/EditorScreen';
import ResultScreen from './components/screens/ResultScreen';
import AdminPanel from './components/screens/AdminPanel';
import PaywallModal from './components/modals/PaywallModal';
import { generateId } from './utils';
import { DEFAULT_ROWS_LAYOUT, DEFAULT_GROUPS_LAYOUT, DEFAULT_STUDENT_CONSTRAINTS } from './constants';
import EditorHeader from './components/layout/EditorHeader';
import { Toaster, toast } from 'sonner';
import { FirestoreQuotaError } from './services/storageService';
import { AlertTriangle } from 'lucide-react';

const ADMIN_EMAIL = "lirondavid3@gmail.com";

const MainHeader: React.FC<{ user: User | null; onLogout: () => void; onGoToAdmin: () => void }> = ({ user, onLogout, onGoToAdmin }) => (
    <header className="bg-white/80 backdrop-blur-sm shadow-sm p-3 flex justify-between items-center print-hidden">
        <div className="flex items-center gap-3">
            {user?.picture && (
                <img src={user.picture} alt={user.name} className="h-10 w-10 rounded-full border border-slate-200" />
            )}
            <div>
                <h1 className="text-xl font-bold text-slate-800 leading-tight">
                    מפות ישיבה<br />וחלוקה לקבוצות
                </h1>
                <div className="flex items-center gap-2">
                    <p className="text-sm text-slate-500">מחובר/ת כ: {user?.name}</p>
                </div>
            </div>
        </div>
        <div className="flex items-center gap-2">
            {(user?.role === 'admin' || user?.email === ADMIN_EMAIL) && (
                <button 
                    onClick={onGoToAdmin}
                    className="text-sm bg-teal-100 text-teal-700 py-1 px-3 rounded border border-teal-200 hover:bg-teal-200 font-bold"
                >
                    ניהול (Admin)
                </button>
            )}
            <button onClick={onLogout} className="text-sm bg-slate-500 text-white py-1 px-3 rounded hover:bg-slate-600">
                יציאה
            </button>
        </div>
    </header>
);

const App: React.FC = () => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [allCharts, setAllCharts] = useState<{ [email: string]: Chart[] }>({});
    const [currentScreen, setCurrentScreen] = useState<Screen>('login');
    const [editingChart, setEditingChart] = useState<Chart | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true); 
    const [isChartDirty, setIsChartDirty] = useState<boolean>(false);
    const [quotaExceeded, setQuotaExceeded] = useState<boolean>(false);
    
    // Refs for debounced saving and loop prevention
    const lastSavedChartsRef = useRef<string>('');
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isInitialLoadRef = useRef<boolean>(true);
    
    // Editor specific states
    const [groupingMethod, setGroupingMethod] = useState('random');

    // --- FIREBASE AUTH INTEGRATION ---
    useEffect(() => {
        // Test connection to Firestore
        const testConnection = async () => {
            if (!db) return;
            try {
                await getDocFromServer(doc(db, 'test', 'connection'));
                console.log("Firestore connection successful");
            } catch (error) {
                if (error instanceof Error && error.message.includes('the client is offline')) {
                    console.error("Please check your Firebase configuration. The client is offline.");
                }
                // Skip logging for other errors, as this is simply a connection test.
            }
        };
        testConnection();

        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser && firebaseUser.email) {
                setIsLoading(true);
                try {
                    // Load full profile from Cloud Database
                    const profile = await loadUserProfile(firebaseUser.email);
                    
                    const user: User = {
                        email: firebaseUser.email,
                        name: firebaseUser.displayName || firebaseUser.email.split('@')[0],
                        picture: firebaseUser.photoURL || null,
                        credits: profile.credits,
                        isSubscribed: profile.isSubscribed,
                        role: profile.role,
                        isFrozen: profile.isFrozen
                    };
                    
                    setCurrentUser(user);
                    const chartsStr = JSON.stringify(profile.charts);
                    lastSavedChartsRef.current = chartsStr;
                    setAllCharts(prev => ({ ...prev, [firebaseUser.email!]: profile.charts }));
                    setCurrentScreen('main');
                } catch (e) {
                    if (e instanceof FirestoreQuotaError) {
                        setQuotaExceeded(true);
                        toast.error("מכסת השימוש בבסיס הנתונים הסתיימה להיום. הנתונים יישמרו מקומית בדפדפן.");
                    }
                    console.error("Error loading profile:", e);
                } finally {
                    setIsLoading(false);
                    isInitialLoadRef.current = false;
                }
            } else {
                setCurrentUser(null);
                setCurrentScreen('login');
                setAllCharts({});
                setIsLoading(false);
            }
        });
        return () => unsubscribe();
    }, []);

    // Real-time profile listener
    useEffect(() => {
        if (!currentUser?.email) return;

        const unsubscribe = onSnapshot(doc(db, "users", currentUser.email), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setCurrentUser(prev => {
                    if (!prev) return null;
                    // Only update if values actually changed to avoid unnecessary re-renders
                    if (prev.credits === data.credits && 
                        prev.isSubscribed === data.isSubscribed && 
                        prev.role === data.role &&
                        prev.isFrozen === data.isFrozen) {
                        return prev;
                    }
                    return {
                        ...prev,
                        credits: data.credits !== undefined ? data.credits : prev.credits,
                        isSubscribed: data.isSubscribed !== undefined ? data.isSubscribed : prev.isSubscribed,
                        role: data.role || prev.role,
                        isFrozen: !!data.isFrozen
                    };
                });
                
                if (data.charts) {
                    try {
                        const charts = typeof data.charts === 'string' ? JSON.parse(data.charts) : data.charts;
                        const chartsStr = JSON.stringify(charts);
                        
                        // Only update if the data from server is different from what we last saved
                        // to prevent infinite loops
                        if (chartsStr !== lastSavedChartsRef.current) {
                            lastSavedChartsRef.current = chartsStr;
                            setAllCharts(prev => ({ ...prev, [currentUser.email!]: charts }));
                        }
                    } catch (e) {
                        console.error("Error parsing charts from snapshot:", e);
                    }
                }
            }
        }, (error) => {
            if (error.message.includes('quota') || error.message.includes('resource-exhausted')) {
                setQuotaExceeded(true);
            }
            handleFirestoreError(error, OperationType.GET, `users/${currentUser.email}`);
        });

        return () => unsubscribe();
    }, [currentUser?.email]);

    // Persist data effect with debouncing and loop prevention
    useEffect(() => {
        if (isLoading || isInitialLoadRef.current || !currentUser?.email) return;
        
        const userCharts = allCharts[currentUser.email];
        if (!userCharts) return;

        const currentChartsStr = JSON.stringify(userCharts);
        
        // If data hasn't changed since last save/load, don't trigger save
        if (currentChartsStr === lastSavedChartsRef.current) return;

        // Clear existing timeout
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        // Debounce save for 3 seconds
        saveTimeoutRef.current = setTimeout(async () => {
            try {
                // Update ref BEFORE saving to prevent race conditions with onSnapshot
                lastSavedChartsRef.current = currentChartsStr;
                
                await saveUserCharts(
                    currentUser.email!, 
                    userCharts, 
                    currentUser.credits, 
                    currentUser.isSubscribed
                );
                setQuotaExceeded(false);
            } catch (err) {
                if (err instanceof FirestoreQuotaError) {
                    setQuotaExceeded(true);
                    toast.error("מכסת השמירה הסתיימה. הנתונים נשמרים זמנית בדפדפן.");
                }
                console.error("Auto-save failed", err);
            }
        }, 3000);

        return () => {
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        };
    }, [allCharts, currentUser?.email, currentUser?.credits, currentUser?.isSubscribed, isLoading]);

    const handleLogout = async () => {
        await signOut(auth);
        setEditingChart(null);
    };
    
    const handleSetEditingChart = (updater: React.SetStateAction<Chart | null>) => {
        setEditingChart(prevChart => {
            const newChart = typeof updater === 'function' ? updater(prevChart) : updater;
            if (JSON.stringify(newChart) !== JSON.stringify(prevChart)) {
                setIsChartDirty(true);
            }
            return newChart;
        });
    };

    const handleSaveCurrentChart = useCallback(() => {
        if (editingChart && currentUser) {
            // Finalize the chart before saving
            const chartToSave = { ...editingChart };
            if (chartToSave.layoutHistory && typeof chartToSave.activeLayoutIndex === 'number') {
                chartToSave.generatedLayout = chartToSave.layoutHistory[chartToSave.activeLayoutIndex];
            }
            // Clean up temporary versioning state
            delete chartToSave.layoutHistory;
            delete chartToSave.activeLayoutIndex;

             setAllCharts(prevAllCharts => {
                const charts = prevAllCharts[currentUser.email] || [];
                const existingIndex = charts.findIndex(c => c.id === chartToSave.id);
                let newCharts;
                if (existingIndex > -1) {
                    newCharts = charts.map((c, index) => index === existingIndex ? chartToSave : c);
                } else {
                    newCharts = [...charts, chartToSave];
                }
                return { ...prevAllCharts, [currentUser.email]: newCharts };
            });
            setIsChartDirty(false); // Reset dirty flag after saving
        }
    }, [editingChart, currentUser]);

    const handleSaveAndExit = () => {
        handleSaveCurrentChart();
        setEditingChart(null);
        setCurrentScreen('main');
    };

    const handleBackToMain = () => {
        if (isChartDirty) {
            if (window.confirm("יש שינויים שלא נשמרו. האם לצאת בכל זאת?")) {
                setEditingChart(null);
                setCurrentScreen('main');
            }
        } else {
            setEditingChart(null);
            setCurrentScreen('main');
        }
    };

    const handleStartNewChart = (className: string, date: string, layoutType: 'rows' | 'groups') => {
        if (currentUser) {
            const newChart: Chart = {
                id: generateId(),
                className,
                creationDate: date,
                layoutType,
                layoutDetails: layoutType === 'rows' ? { ...DEFAULT_ROWS_LAYOUT } : { ...DEFAULT_GROUPS_LAYOUT },
                students: [],
                generatedLayout: null,
            };

            setAllCharts(prev => {
                 const currentCharts = prev[currentUser.email] || [];
                 const updatedCharts = [newChart, ...currentCharts];
                 return { ...prev, [currentUser.email]: updatedCharts };
            });

            setEditingChart(newChart);
            setCurrentScreen('editor');
            setIsChartDirty(false); 
            setGroupingMethod('random');
        }
    };
    
    const handleLoadChart = (chartId: string) => {
        if (!currentUser) return;
        const chartToLoad = allCharts[currentUser.email]?.find(c => c.id === chartId);
        if (chartToLoad) {
            let migratedChart = JSON.parse(JSON.stringify(chartToLoad));
            if (migratedChart.layoutType === 'rows') {
                const details = migratedChart.layoutDetails as RowsLayoutDetails;
                if (details.rows && details.cols && !details.columnConfiguration) {
                    details.columnConfiguration = Array(details.cols).fill(details.rows);
                    delete details.rows;
                    delete details.cols;
                }
            }
            const cleanChart = {...migratedChart};

            setEditingChart(cleanChart);
            setCurrentScreen(cleanChart.generatedLayout ? 'result' : 'editor');
            setIsChartDirty(false);
        }
    };
    
    const handleDeleteChart = useCallback((chartId: string) => {
        if (!currentUser) return;
        const userEmail = currentUser.email;
        setAllCharts(prevAllCharts => {
            const currentCharts = prevAllCharts[userEmail] || [];
            const updatedCharts = currentCharts.filter(c => c.id !== chartId);
            return {
                ...prevAllCharts,
                [userEmail]: updatedCharts
            };
        });
    }, [currentUser]);

    const handleDuplicateChart = useCallback((chartId: string, keepConstraints: boolean) => {
        if (!currentUser) return;
        const userEmail = currentUser.email;
        setAllCharts(prev => {
            const charts = prev[userEmail] || [];
            const originalChart = charts.find(c => c.id === chartId);
    
            if (!originalChart) return prev;
    
            const newChart = JSON.parse(JSON.stringify(originalChart)) as Chart;
    
            newChart.id = generateId();
            newChart.creationDate = new Date().toISOString();
            newChart.generatedLayout = null;
            
            if (!keepConstraints) {
                newChart.students = newChart.students.map(student => {
                    const newStudent: Student = {
                        id: student.id,
                        name: student.name,
                        picture: student.picture,
                        gender: student.gender,
                        ratings: {},
                        constraints: { ...DEFAULT_STUDENT_CONSTRAINTS },
                        academicLevel: undefined,
                        behaviorLevel: undefined,
                    };
                    return newStudent;
                });
            }
    
            const updatedCharts = [newChart, ...charts];
    
            return {
                ...prev,
                [userEmail]: updatedCharts
            };
        });
    }, [currentUser]);
    
    const handleDeleteClass = useCallback((className: string) => {
        if (!currentUser) return;
        const userEmail = currentUser.email;
        setAllCharts(prevAllCharts => {
            const currentCharts = prevAllCharts[userEmail] || [];
            const updatedCharts = currentCharts.filter(c => c.className !== className);
            return {
                ...prevAllCharts,
                [userEmail]: updatedCharts
            };
        });
    }, [currentUser]);

    const handleUpdateClassName = useCallback((oldClassName: string, newClassName: string): boolean => {
        if (!currentUser) return false;
        const userEmail = currentUser.email;
        const trimmedNewName = newClassName.trim();
        if (!trimmedNewName) {
            alert('שם הכיתה לא יכול להיות ריק.');
            return false;
        }

        let success = true;

        setAllCharts(prevAllCharts => {
            const userCharts = prevAllCharts[userEmail] || [];
            const existingClassNames = Array.from(new Set(userCharts.map(c => c.className)));
            if (existingClassNames.some((cn: string) => cn.toLowerCase() === trimmedNewName.toLowerCase() && cn.toLowerCase() !== oldClassName.toLowerCase())) {
                alert('כיתה בשם זה כבר קיימת.');
                success = false;
                return prevAllCharts;
            }

            const updatedCharts = userCharts.map(chart => {
                if (chart.className === oldClassName) {
                    return { ...chart, className: trimmedNewName };
                }
                return chart;
            });
            
            return { ...prevAllCharts, [userEmail]: updatedCharts };
        });
        
        return success;
    }, [currentUser]);


    const handleGenerateChart = async (chartToGenerate?: Chart, preGeneratedLayout?: GeneratedLayout | null) => {
        const chart = chartToGenerate || editingChart;
        if (!chart || !currentUser) return;
        
        if (chartToGenerate) {
            handleSetEditingChart(chartToGenerate); 
        }

        setIsLoading(true);

        await new Promise(resolve => setTimeout(resolve, 50)); 

        try {
            const result = preGeneratedLayout || generateLayout(chart, groupingMethod);

            const currentHistory = chart.layoutHistory || (chart.generatedLayout ? [chart.generatedLayout] : []);
            const newHistory = [...currentHistory, result];
            const newIndex = newHistory.length - 1;

            const updatedChart = { 
                ...chart, 
                generatedLayout: result,
                layoutHistory: newHistory,
                activeLayoutIndex: newIndex
            };
            
            setEditingChart(updatedChart);
            setIsChartDirty(true); 

            // Decrement credits if not subscribed
            if (!currentUser.isSubscribed) {
                setCurrentUser(prev => prev ? { ...prev, credits: Math.max(0, prev.credits - 1) } : null);
            }

            setCurrentScreen('result');
        } catch (error) {
            console.error("Error in chart generation:", error);
            alert(`אירעה שגיאה בעת יצירת המפה/קבוצות. פרטי השגיאה: ${error instanceof Error ? error.message : String(error)}`);
            setCurrentScreen('editor'); 
        } finally {
            setIsLoading(false);
        }
    };

    const handleChangeVersion = (newIndex: number) => {
        if (!editingChart || !editingChart.layoutHistory) return;

        if (newIndex >= 0 && newIndex < editingChart.layoutHistory.length) {
            handleSetEditingChart(prev => {
                if (!prev || !prev.layoutHistory) return prev;
                return {
                    ...prev,
                    activeLayoutIndex: newIndex,
                    generatedLayout: prev.layoutHistory[newIndex],
                };
            });
        }
    };
    
    const handleConvertLayout = () => {
        if (!editingChart) return;
        const newType = editingChart.layoutType === 'rows' ? 'groups' : 'rows';
        const newLayoutDetails = newType === 'rows' ? { ...DEFAULT_ROWS_LAYOUT } : { ...DEFAULT_GROUPS_LAYOUT };
        
        const convertedChart: Chart = {
            ...editingChart,
            layoutType: newType,
            layoutDetails: newLayoutDetails,
            generatedLayout: null,
        };
        
        handleSetEditingChart(convertedChart);
        setCurrentScreen('editor');
    };

    const handleSpreadStudents = () => {
        if (!editingChart || editingChart.layoutType !== 'rows' || !editingChart.generatedLayout) {
            return;
        }
    
        const chart = JSON.parse(JSON.stringify(editingChart)) as Chart; // Deep copy
        if (!chart.generatedLayout || !('desks' in chart.generatedLayout)) {
            return;
        }
    
        // --- Start: Local helper functions ---
        const allStudentsMap = new Map(chart.students.map(s => [s.name, s]));
        const getStudentById = (id: string) => chart.students.find(s => s.id === id);
    
        const checkDeskPositionConstraints = (student: Student, row: number, col: number): boolean => {
            const constraints = { ...DEFAULT_STUDENT_CONSTRAINTS, ...(student.constraints || {}) };
            const { allowedRows, allowedCols } = constraints;
            if (allowedRows && allowedRows.length > 0 && !allowedRows.includes(row)) return false;
            if (allowedCols && allowedCols.length > 0 && !allowedCols.includes(col)) return false;
            return true;
        };
    
        const canSitTogether = (student1Name: string, student2Name: string): boolean => {
            const student1 = allStudentsMap.get(student1Name);
            const student2 = allStudentsMap.get(student2Name);
            if (!student1 || !student2) return true;
            const student1DontSitWithNames = (student1.constraints.dontSitWith || []).map(id => getStudentById(id)?.name).filter(Boolean) as string[];
            const student2DontSitWithNames = (student2.constraints.dontSitWith || []).map(id => getStudentById(id)?.name).filter(Boolean) as string[];
            return !student1DontSitWithNames.includes(student2Name) && !student2DontSitWithNames.includes(student1Name);
        };
        // --- End: Local helper functions ---
    
        const { desks } = chart.generatedLayout;
        
        // === PHASE 1: Place unplaced students ===
        let studentsToPlace = (chart.generatedLayout.unplacedStudents || [])
            .map(info => allStudentsMap.get(info.name))
            .filter((s): s is Student => !!s);
            
        let stillUnplacedStudents: UnplacedStudentInfo[] = [];
        studentsToPlace.sort(() => Math.random() - 0.5);
    
        for (const student of studentsToPlace) {
            let placed = false;
            
            // Try empty desks first to maximize desk usage
            for (const desk of desks) {
                if (desk.students.length === 0 && checkDeskPositionConstraints(student, desk.row, desk.col)) {
                    desk.students.push({ name: student.name, seat: 1 });
                    placed = true;
                    break;
                }
            }
            
            if (placed) continue;
            
            // Then try desks with 1 student
            for (const desk of desks) {
                if (desk.students.length === 1) {
                    const occupant = allStudentsMap.get(desk.students[0].name);
                    if (occupant && !occupant.constraints.sitAlone && checkDeskPositionConstraints(student, desk.row, desk.col) && canSitTogether(student.name, occupant.name)) {
                        const occupiedSeat = desk.students[0].seat;
                        desk.students.push({ name: student.name, seat: occupiedSeat === 1 ? 2 : 1 });
                        placed = true;
                        break;
                    }
                }
            }
    
            if (!placed) {
                stillUnplacedStudents.push({ name: student.name, reason: "לא נמצא מקום פנוי שעומד באילוצים במהלך הפריסה." });
            }
        }
    
        chart.generatedLayout.unplacedStudents = stillUnplacedStudents;
    
        // === PHASE 2: Spread existing pairs into remaining empty desks ===
        let pairedDesks = desks.filter(d => d.students.length === 2);
        let emptyDesks = desks.filter(d => d.students.length === 0);

        pairedDesks.sort(() => Math.random() - 0.5);
    
        while (pairedDesks.length > 0 && emptyDesks.length > 0) {
            const sourceDesk = pairedDesks.shift()!;
    
            for (let i = sourceDesk.students.length - 1; i >= 0; i--) {
                const studentInfo = sourceDesk.students[i];
                const student = allStudentsMap.get(studentInfo.name);
                if (!student) continue;
    
                const partnerInfo = sourceDesk.students[i === 0 ? 1 : 0];
                const partner = allStudentsMap.get(partnerInfo.name);
                if (partner && (student.constraints.sitWith || []).includes(partner.id)) {
                    continue; 
                }
    
                let targetDeskIndex = -1;
                for (let j = 0; j < emptyDesks.length; j++) {
                    if (checkDeskPositionConstraints(student, emptyDesks[j].row, emptyDesks[j].col)) {
                        targetDeskIndex = j;
                        break;
                    }
                }
    
                if (targetDeskIndex !== -1) {
                    const targetDesk = emptyDesks.splice(targetDeskIndex, 1)[0];
                    sourceDesk.students.splice(i, 1);
                    targetDesk.students.push({ name: student.name, seat: 1 });
                    break; 
                }
            }
        }
        
        handleSetEditingChart(chart);
        setIsChartDirty(true);
    };

    const handleClearPins = () => {
        if (!editingChart) return;
        if (window.confirm("האם לבטל את כל הנעיצות (המיקומים הקבועים) של התלמידים?")) {
            const newChart = JSON.parse(JSON.stringify(editingChart)) as Chart;
            newChart.students.forEach((s: Student) => {
                s.constraints = {
                    ...s.constraints,
                    allowedRows: null,
                    allowedCols: null,
                    allowedSeats: null
                };
            });
            handleSetEditingChart(newChart);
            setIsChartDirty(true);
            toast.success("כל הנעיצות בוטלו בהצלחה");
        }
    };
    
    const renderContent = () => {
        if (currentScreen === 'login') {
            return <LoginScreen onLogin={() => {}} />;
        }

        if (isLoading) {
             return (
                <div className="flex flex-col items-center justify-center h-full">
                    <div className="animate-spin-fast rounded-full h-16 w-16 border-b-4 border-teal-500 mx-auto"></div>
                    <h2 className="text-2xl font-bold text-slate-700 mt-6">טוען נתונים מהענן...</h2>
                </div>
            );
        }
        
        if (currentUser?.isFrozen) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border-t-4 border-red-500">
                    <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                        <AlertTriangle className="h-8 w-8 text-red-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-4">חשבונך הוקפא</h2>
                    <p className="text-slate-600 mb-8 leading-relaxed">
                        הגישה לאפליקציה הופסקה זמנית על ידי מנהל המערכת. 
                        אנא צור קשר עם לירן לפרטים נוספים.
                    </p>
                    <button 
                        onClick={handleLogout}
                        className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold hover:bg-slate-700 transition-all"
                    >
                        התנתק
                    </button>
                </div>
            </div>
        );
    }

    switch (currentScreen) {
            case 'main':
                return currentUser && <MainScreen
                    user={currentUser}
                    allCharts={allCharts[currentUser.email] || []}
                    onStartNew={handleStartNewChart}
                    onLoadChart={handleLoadChart}
                    onDeleteChart={handleDeleteChart}
                    onDuplicateChart={handleDuplicateChart}
                    onDeleteClass={handleDeleteClass}
                    onUpdateClassName={handleUpdateClassName}
                    setAllCharts={(charts) => setAllCharts(prev => ({...prev, [currentUser.email]: charts}))}
                    isCloudSync={!!auth}
                />;
            case 'editor':
                return editingChart && <EditorScreen 
                    chart={editingChart}
                    setChart={handleSetEditingChart}
                    onGenerate={handleGenerateChart}
                    groupingMethod={groupingMethod}
                    setGroupingMethod={setGroupingMethod}
                />;
            case 'result':
                return editingChart && <ResultScreen 
                    chart={editingChart}
                    onRegenerate={handleGenerateChart}
                    onGoToEditor={() => setCurrentScreen('editor')}
                    onUpdateChart={(updatedChart) => handleSetEditingChart(updatedChart)}
                    onClearPins={handleClearPins}
                />;
            case 'admin':
                return <AdminPanel onBack={() => setCurrentScreen('main')} />;
            default:
                return null; 
        }
    };

    if (isLoading && !currentUser) {
       return (
           <div className="min-h-screen flex items-center justify-center bg-slate-100">
               <div className="animate-spin-fast rounded-full h-16 w-16 border-b-4 border-teal-500 mx-auto"></div>
           </div>
       );
   }

    if (currentScreen === 'login' && !currentUser) {
        return <div className="min-h-screen flex items-center justify-center bg-slate-100">{renderContent()}</div>;
    }
    
    if (!currentUser) return null;

    const isEditorOrResult = ['editor', 'result'].includes(currentScreen);

    return (
        <div className="min-h-screen flex flex-col bg-slate-100 overflow-hidden" dir="rtl">
            <Toaster position="top-center" richColors />
            
            {quotaExceeded && (
                <div className="bg-amber-50 border-b border-amber-200 p-2 flex items-center justify-center gap-2 text-amber-800 text-sm font-medium">
                    <AlertTriangle size={16} />
                    <span>מכסת השימוש היומית בבסיס הנתונים הסתיימה. השינויים נשמרים מקומית בדפדפן שלך.</span>
                </div>
            )}

             {isEditorOrResult && editingChart ? (
                <EditorHeader
                    chart={editingChart}
                    currentScreen={currentScreen}
                    onSaveAndExit={handleSaveAndExit}
                    onBackToMain={handleBackToMain}
                    onGoToEditor={() => setCurrentScreen('editor')}
                    onUpdateChart={handleSetEditingChart}
                    onRegenerate={() => handleGenerateChart(editingChart)}
                    onConvertLayout={handleConvertLayout}
                    onSpreadStudents={handleSpreadStudents}
                    onClearPins={handleClearPins}
                    onChangeVersion={handleChangeVersion}
                />
             ) : (
                <MainHeader 
                    user={currentUser} 
                    onLogout={handleLogout} 
                    onGoToAdmin={() => setCurrentScreen('admin')} 
                />
             )}
            <main className="flex-grow flex flex-col overflow-hidden relative">
                {renderContent()}
            </main>
        </div>
    );
};

export default App;
