import React, { useState, useEffect } from 'react';
import { Chart, Screen, RowsLayoutDetails } from '../../types';
import { PrintIcon, PencilIcon, ShuffleIcon, SwitchHorizontalIcon, BalancedIcon, DownloadIcon, PdfIcon, PinIcon } from '../icons';
import ConfirmActionModal from '../modals/ConfirmActionModal';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface EditorHeaderProps {
    chart: Chart;
    currentScreen: Screen;
    onSaveAndExit: () => void;
    onBackToMain: () => void;
    onGoToEditor: () => void;
    onUpdateChart: (updater: React.SetStateAction<Chart | null>) => void;
    onRegenerate: () => void;
    onConvertLayout: () => void;
    onSpreadStudents: () => void;
    onChangeVersion: (newIndex: number) => void;
    onClearPins?: () => void;
}

const EditorHeader: React.FC<EditorHeaderProps> = ({ chart, currentScreen, onSaveAndExit, onBackToMain, onGoToEditor, onUpdateChart, onRegenerate, onConvertLayout, onSpreadStudents, onChangeVersion, onClearPins }) => {
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editedClassName, setEditedClassName] = useState(chart.className);
    const [isConfirmingConvert, setIsConfirmingConvert] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
    
    const formatForDateTimeLocal = (isoString: string) => {
        const date = new Date(isoString);
        const timezoneOffsetInMs = date.getTimezoneOffset() * 60000;
        const localDate = new Date(date.getTime() - timezoneOffsetInMs);
        return localDate.toISOString().slice(0, 16);
    };

    const [editedDate, setEditedDate] = useState(formatForDateTimeLocal(chart.creationDate));

    useEffect(() => {
        setEditedClassName(chart.className);
        setEditedDate(formatForDateTimeLocal(chart.creationDate));
    }, [chart]);

    const handleSaveTitle = () => {
        if (!editedClassName.trim()) {
            alert("שם הכיתה לא יכול להיות ריק.");
            return;
        }
        onUpdateChart(prev => prev ? {
            ...prev,
            className: editedClassName.trim(),
            creationDate: new Date(editedDate).toISOString(),
        } : null);
        setIsEditingTitle(false);
    };

    const handleCancelEditTitle = () => {
        setEditedClassName(chart.className);
        setEditedDate(formatForDateTimeLocal(chart.creationDate));
        setIsEditingTitle(false);
    };

    const handleConfirmConvert = () => {
        onConvertLayout();
        setIsConfirmingConvert(false);
    };

    const handleDownloadImage = async () => {
        const element = document.getElementById('printable-area');
        if (!element) {
            alert('לא נמצאה המפה להורדה.');
            return;
        }
    
        setIsDownloading(true);
        
        try {
            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
            });
    
            const image = canvas.toDataURL('image/png', 1.0);
            const link = document.createElement('a');
            
            const fileName = `${chart.layoutType === 'rows' ? 'map' : 'groups'}_${chart.className.replace(/\s/g, '_')}_${new Date(chart.creationDate).toLocaleDateString('he-IL').replace(/\./g, '_')}.png`;
            link.download = fileName;
            link.href = image;
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('Error generating image:', error);
            alert('אירעה שגיאה בעת יצירת התמונה.');
        } finally {
            setIsDownloading(false);
        }
    };

    const handleDownloadPdf = async () => {
        const element = document.getElementById('printable-area');
        if (!element) {
            alert('לא נמצאה המפה להורדה.');
            return;
        }
    
        setIsDownloadingPdf(true);
    
        try {
            const canvas = await html2canvas(element, {
                scale: 3, // Higher scale for better PDF quality
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
                onclone: (clonedDoc) => {
                    const el = clonedDoc.getElementById('printable-area');
                    if (el) {
                        // Base styles for clean capture
                        el.style.width = '1120px'; // Match UI landscape width
                        el.style.minHeight = '792px'; // Match UI landscape height
                        el.style.margin = '0';
                        el.style.padding = '40px';
                        el.style.boxShadow = 'none';
                        el.style.borderRadius = '0';
                        el.style.backgroundColor = '#ffffff';
                        el.style.display = 'flex';
                        el.style.flexDirection = 'column';
                        el.style.alignItems = 'center';
                        
                        const grid = el.querySelector('.classroom-grid');
                        const groups = el.querySelector('.groups-grid');
                        
                        if (grid) {
                            (grid as HTMLElement).style.margin = '0 auto';
                            (grid as HTMLElement).style.width = 'fit-content';
                            (grid as HTMLElement).style.display = 'inline-grid';
                            (grid as HTMLElement).style.gap = '48px'; // 12 * 4 (approx)
                            const numCols = chart.layoutType === 'rows' ? (chart.layoutDetails as RowsLayoutDetails).columnConfiguration.length : 0;
                            (grid as HTMLElement).style.gridTemplateColumns = `auto repeat(${numCols}, minmax(180px, 1fr))`;
                            
                            const desks = el.querySelectorAll('.desk-container');
                            desks.forEach((desk) => {
                                (desk as HTMLElement).style.width = '180px';
                                (desk as HTMLElement).style.height = '100px';
                            });
                        }
                        
                        if (groups) {
                            (groups as HTMLElement).style.width = '100%';
                            (groups as HTMLElement).style.display = 'grid';
                            (groups as HTMLElement).style.gridTemplateColumns = 'repeat(4, 1fr)';
                            (groups as HTMLElement).style.gap = '24px';
                        }
                    }
                }
            });
    
            const imageData = canvas.toDataURL('image/png', 1.0);
            
            // A4 page in mm: 297 width, 210 height (landscape)
            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4'
            });
    
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const margin = 10; // 10mm margin
            const usableWidth = pdfWidth - (margin * 2);
            const usableHeight = pdfHeight - (margin * 2);
            
            const canvasWidth = canvas.width;
            const canvasHeight = canvas.height;
            const canvasRatio = canvasWidth / canvasHeight;
    
            let imgWidth = usableWidth;
            let imgHeight = imgWidth / canvasRatio;
            
            if (imgHeight > usableHeight) {
                imgHeight = usableHeight;
                imgWidth = imgHeight * canvasRatio;
            }
    
            const x = margin + (usableWidth - imgWidth) / 2;
            const y = margin + (usableHeight - imgHeight) / 2;
            
            pdf.addImage(imageData, 'PNG', x, y, imgWidth, imgHeight);
    
            const fileName = `${chart.layoutType === 'rows' ? 'map' : 'groups'}_${chart.className.replace(/\s/g, '_')}_${new Date(chart.creationDate).toLocaleDateString('he-IL').replace(/\./g, '_')}.pdf`;
            
            pdf.save(fileName);
    
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('אירעה שגיאה בעת יצירת קובץ ה-PDF.');
        } finally {
            setIsDownloadingPdf(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };


    const formattedDateTime = new Date(chart.creationDate).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', ' ');
    const convertButtonText = chart.layoutType === 'rows' ? 'המר לקבוצות' : 'המר למפה';
    const conversionMessage = `האם להפוך את המערך ל'${chart.layoutType === 'rows' ? 'קבוצות' : 'מפת ישיבה'}'? רשימת התלמידים והאילוצים יישמרו. הגדרות המבנה הישן (כמו מספר שורות וטורים) יוחלפו בהגדרות ברירת מחדל חדשות.`;

    const { layoutHistory, activeLayoutIndex } = chart;
    const showVersionNavigator = currentScreen === 'result' && layoutHistory && layoutHistory.length > 1 && typeof activeLayoutIndex === 'number';

    return (
        <header className="bg-white/95 backdrop-blur-sm shadow-md p-2 md:p-3 flex items-center justify-between print-hidden z-30 shrink-0">
            <div className="w-1/4 md:w-1/3 flex justify-start">
                <button onClick={onBackToMain} className="text-xs md:text-sm text-slate-500 hover:text-sky-600 font-semibold p-1 md:p-2 flex items-center gap-1">
                    <span>&larr;</span>
                    <span className="hidden md:inline">חזרה</span>
                </button>
            </div>
            
            <div className="w-2/4 md:w-1/3 flex flex-col items-center gap-1 md:gap-2">
                {isEditingTitle ? (
                    <div className="flex flex-col md:flex-row items-center gap-1 md:gap-2">
                        <input 
                            type="text"
                            value={editedClassName}
                            onChange={(e) => setEditedClassName(e.target.value)}
                            className="p-1 border rounded-md text-[10px] md:text-sm w-full md:w-auto"
                        />
                        <div className="flex items-center gap-1">
                            <input
                                type="datetime-local"
                                value={editedDate}
                                onChange={(e) => setEditedDate(e.target.value)}
                                className="p-1 border rounded-md text-[10px] md:text-sm"
                            />
                            <button onClick={handleSaveTitle} className="text-[10px] bg-green-500 text-white py-1 px-2 rounded-md hover:bg-green-600">שמור</button>
                            <button onClick={handleCancelEditTitle} className="text-[10px] bg-slate-200 text-slate-700 py-1 px-2 rounded-md hover:bg-slate-300">בטל</button>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-1 md:gap-2">
                        <div className="text-center">
                             <h1 className="text-[10px] md:text-lg font-bold text-slate-800 leading-tight">מערך ישיבה</h1>
                             <h2 className="text-[8px] md:text-sm font-medium text-slate-500 truncate max-w-[80px] md:max-w-none">{chart.className}</h2>
                        </div>
                        <button onClick={() => setIsEditingTitle(true)} className="p-1 text-slate-400 hover:text-sky-600"><PencilIcon className="h-3 w-3 md:h-4 md:w-4" /></button>
                    </div>
                )}
                {showVersionNavigator && (
                    <div className="flex items-center gap-2 md:gap-3 text-[10px] md:text-sm font-semibold text-slate-700">
                        <button 
                            onClick={() => onChangeVersion(activeLayoutIndex - 1)}
                            disabled={activeLayoutIndex === 0}
                            className="p-1 leading-none rounded-md bg-slate-200 hover:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="הגרסה הקודמת"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 md:h-4 md:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                        </button>
                        <span>גרסה {activeLayoutIndex + 1} / {layoutHistory.length}</span>
                         <button 
                            onClick={() => onChangeVersion(activeLayoutIndex + 1)}
                            disabled={activeLayoutIndex >= layoutHistory.length - 1}
                            className="p-1 leading-none rounded-md bg-slate-200 hover:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="הגרסה הבאה"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 md:h-4 md:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                        </button>
                    </div>
                )}
            </div>

            <div className="w-1/4 md:w-1/3 flex items-center justify-end gap-1 md:gap-3">
                <div className="hidden lg:flex items-center gap-2">
                    <button onClick={() => setIsConfirmingConvert(true)} className="text-xs bg-slate-200 text-slate-700 font-semibold hover:bg-slate-300 p-1.5 rounded-md flex items-center gap-1" title={convertButtonText}>
                        <SwitchHorizontalIcon className="h-4 w-4" /> <span>{convertButtonText}</span>
                    </button>
                    {currentScreen === 'result' && (
                        <>
                            {chart.layoutType === 'rows' && (
                               <>
                                   <button onClick={onSpreadStudents} className="text-xs bg-slate-200 text-slate-700 font-semibold hover:bg-slate-300 p-1.5 rounded-md flex items-center gap-1" title="פרוס תלמידים בכיתה">
                                        <BalancedIcon className="h-4 w-4" /> <span>פריסה</span>
                                   </button>
                               </>
                            )}
                            <button onClick={onRegenerate} className="text-xs bg-slate-200 text-slate-700 font-semibold hover:bg-slate-300 p-1.5 rounded-md flex items-center gap-1" title="ערבב מחדש">
                                <ShuffleIcon className="h-4 w-4" /> <span>ערבב</span>
                            </button>
                            <button onClick={onGoToEditor} className="text-xs bg-slate-200 text-slate-700 font-semibold hover:bg-slate-300 p-1.5 rounded-md flex items-center gap-1" title="חזרה לעריכה">
                                <PencilIcon className="h-4 w-4" /> <span>עריכה</span>
                            </button>
                        </>
                    )}
                </div>

                {currentScreen === 'result' && (
                    <div className="flex items-center gap-1">
                        <button 
                            onClick={handlePrint} 
                            className="p-1.5 md:p-2 bg-slate-200 text-slate-700 rounded-md hover:bg-slate-300" 
                            title="הדפסה"
                        >
                            <PrintIcon className="h-4 w-4" />
                        </button>
                        <button 
                            onClick={handleDownloadImage} 
                            disabled={isDownloading}
                            className="p-1.5 md:p-2 bg-slate-200 text-slate-700 rounded-md hover:bg-slate-300 disabled:opacity-50" 
                            title="הורדה כתמונה"
                        >
                            <DownloadIcon className="h-4 w-4" />
                        </button>
                        <button 
                            onClick={handleDownloadPdf} 
                            disabled={isDownloadingPdf}
                            className="p-1.5 md:p-2 bg-slate-200 text-slate-700 rounded-md hover:bg-slate-300 disabled:opacity-50" 
                            title="הורדה כ-PDF"
                        >
                            <PdfIcon className="h-4 w-4" />
                        </button>
                    </div>
                )}

                 <button 
                    onClick={onSaveAndExit} 
                    className="py-1.5 md:py-2 px-3 md:px-5 bg-teal-500 text-white font-bold rounded-md hover:bg-teal-600 text-[10px] md:text-sm shadow-sm whitespace-nowrap"
                >
                    שמירה
                </button>
            </div>
            {isConfirmingConvert && (
                <ConfirmActionModal
                    title="אישור המרת מערך"
                    message={conversionMessage}
                    confirmText="אשר המרה"
                    onConfirm={handleConfirmConvert}
                    onCancel={() => setIsConfirmingConvert(false)}
                />
            )}
        </header>
    );
};

export default EditorHeader;