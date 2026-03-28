import React, { useState } from 'react';
import { Chart, GeneratedRowsLayout, RowsLayoutDetails, Student } from '../../types';
import { DoorIcon, WindowIcon, UserIcon, MaleIcon, FemaleIcon, PinIcon } from '../icons';

interface RatingIndicatorProps {
    type: 'academic' | 'behavior';
    level: number;
}

const RatingIndicator: React.FC<RatingIndicatorProps> = ({ type, level }) => {
    const label = type === 'academic' ? 'לימוד:' : 'התנהגות:';
    const title = `${type === 'academic' ? 'רמה לימודית' : 'רמת התנהגות'}: ${level} מתוך 5`;

    const levelColorMap: { [key: number]: string } = {
        1: 'bg-red-500',
        2: 'bg-orange-500',
        3: 'bg-amber-500',
        4: 'bg-green-600',
        5: 'bg-sky-600',
    };
    
    const color = levelColorMap[level] || 'bg-gray-400';

    return (
        <div className="flex items-center gap-1.5" title={title}>
            <span className="text-xs font-medium text-slate-600 w-12 text-right">{label}</span>
            <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div
                        key={i}
                        className={`w-2.5 h-2.5 rounded-full ${i < level ? color : 'bg-slate-200'}`}
                    />
                ))}
            </div>
        </div>
    );
};


interface ClassroomGridProps {
    chart: Chart;
    onEditStudent: (studentName: string) => void;
    onTogglePin?: (studentName: string, row: number, col: number, seat: number) => void;
    onStudentSwap: (
        draggedInfo: { studentName: string; row: number; col: number; seat: number },
        droppedInfo: { studentName: string; row: number; col: number; seat: number }
    ) => void;
    onStudentMove: (
        draggedInfo: { studentName: string; row: number; col: number; seat: number },
        droppedInfo: { row: number; col: number; seat: number }
    ) => void;
    showConstraints?: boolean;
}

interface StudentDisplayProps {
    student: Student | null | undefined;
    isPinned?: boolean;
    onTogglePin?: (e: React.MouseEvent) => void;
    showConstraints?: boolean;
    seatNumber?: number;
}

const StudentDisplay: React.FC<StudentDisplayProps> = ({ student, isPinned, onTogglePin, showConstraints = true, seatNumber }) => {
    const genderColor = student?.gender === 'זכר' ? 'text-sky-600' : student?.gender === 'נקבה' ? 'text-pink-500' : 'text-slate-800';

    return (
        <div className="w-full h-full flex flex-col items-center justify-center p-1 relative">
            {student ? (
                <>
                    <div className={`absolute ${seatNumber === 1 ? 'top-0.5 left-0.5' : 'top-0.5 right-0.5'} flex gap-0.5`}>
                         {student.gender === 'זכר' && <MaleIcon title="זכר" className="h-4 w-4 text-sky-500" />}
                         {student.gender === 'נקבה' && <FemaleIcon title="נקבה" className="h-4 w-4 text-pink-500" />}
                    </div>
                    {onTogglePin && showConstraints && (
                        <button 
                            onClick={onTogglePin}
                            className={`absolute ${seatNumber === 1 ? 'top-7 right-0.5' : 'top-7 left-0.5'} p-0.5 rounded-full transition-colors ${isPinned ? 'bg-amber-100 text-amber-700' : 'text-slate-500 hover:text-slate-800'}`}
                            title={isPinned ? "התלמיד נעוץ למקום זה (לחץ לביטול)" : "נעץ תלמיד זה למקום הנוכחי"}
                        >
                            <PinIcon className="h-4 w-4" />
                        </button>
                    )}
                    {student.picture ? <img src={student.picture} alt={student.name} className="student-picture w-10 h-10 rounded-full object-cover border-2 border-gray-300"/> : <div className="student-picture w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center border-2 border-gray-300"><UserIcon className='w-6 h-6 text-gray-500' /></div>}
                    <span className={`student-name ${genderColor} text-xs font-medium text-center break-words leading-tight mt-0.5`}>{student.name}</span>
                    {showConstraints && (
                        <div className="flex flex-col items-start mt-1 space-y-0.5 scale-[0.8] origin-center">
                            {student.academicLevel && <RatingIndicator type="academic" level={student.academicLevel} />}
                            {student.behaviorLevel && <RatingIndicator type="behavior" level={student.behaviorLevel} />}
                        </div>
                    )}
                </>
            ) : <div className="w-10 h-10 rounded-full bg-sky-200/50"></div>}
        </div>
    );
};

const ClassroomGrid: React.FC<ClassroomGridProps> = ({ chart, onEditStudent, onTogglePin, onStudentSwap, onStudentMove, showConstraints = true }) => {
    const [dragOverInfo, setDragOverInfo] = useState<{ row: number; col: number; seat: number } | null>(null);
    const layout = chart.layoutDetails as RowsLayoutDetails;
    const { generatedLayout } = chart;
    const { desks, unplacedStudents } = generatedLayout as GeneratedRowsLayout;
    
    const { columnConfiguration = [], teacherDeskPosition, windowPosition, doorPosition } = layout;
    const numCols = columnConfiguration.length;
    const maxRows = Math.max(0, ...columnConfiguration);

    const handleDragStart = (e: React.DragEvent, studentName: string, row: number, col: number, seat: number) => {
        e.dataTransfer.setData('application/json', JSON.stringify({ studentName, row, col, seat }));
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent, row: number, col: number, seat: number) => {
        e.preventDefault();
        setDragOverInfo({ row, col, seat });
    };

    const handleDragLeave = () => {
        setDragOverInfo(null);
    };

    const handleDropOnStudent = (e: React.DragEvent, droppedOnStudentName: string, row: number, col: number, seat: number) => {
        e.preventDefault();
        setDragOverInfo(null);
        try {
            const draggedInfo = JSON.parse(e.dataTransfer.getData('application/json'));
            if (draggedInfo.studentName === droppedOnStudentName) return;
            
            const droppedInfo = { studentName: droppedOnStudentName, row, col, seat };
            onStudentSwap(draggedInfo, droppedInfo);
        } catch (error) {
            console.error("Failed to parse drag data", error);
        }
    };

    const handleDropOnEmpty = (e: React.DragEvent, row: number, col: number, seat: number) => {
        e.preventDefault();
        setDragOverInfo(null);
        try {
            const draggedInfo = JSON.parse(e.dataTransfer.getData('application/json'));
            const droppedInfo = { row, col, seat };
            onStudentMove(draggedInfo, droppedInfo);
        } catch (error) {
            console.error("Failed to parse drag data", error);
        }
    };

    const TeacherDesk = () => <div className="bg-teal-600 text-teal-50 flex items-center justify-center rounded-lg shadow-md text-sm font-semibold w-[110px] h-[40px]">שולחן מורה</div>;
    const Door = () => <div className="flex items-center gap-1 text-amber-600 text-sm font-medium"><DoorIcon className="h-8 w-8" /><span>דלת</span></div>;
    const WindowEl = () => <div className="flex items-center gap-1 text-green-600 text-sm font-medium"><WindowIcon className="h-8 w-8" /><span>חלון</span></div>;

    const getStudentByName = (name?: string) => name ? chart.students.find(s => s.name === name) : undefined;

    const formattedDateTime = new Date(chart.creationDate).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', ' ');
    
    const SideItems = () => (
        <div className="flex justify-center items-center space-x-6 space-x-reverse">
            <div className="flex items-center space-x-4 space-x-reverse">
                {doorPosition === 'right' && <Door />}
                {windowPosition === 'right' && <WindowEl />}
            </div>
            <TeacherDesk />
            <div className="flex items-center space-x-4 space-x-reverse">
                {doorPosition === 'left' && <Door />}
                {windowPosition === 'left' && <WindowEl />}
            </div>
        </div>
    );

    return (
        <div className="w-full overflow-x-auto bg-gray-100 p-4">
            <div id="printable-area" className="bg-white mx-auto shadow-lg p-2 w-fit min-w-max flex flex-col items-center">
                <div className="text-center mb-1">
                    <h1 className="text-2xl font-bold text-teal-900">{chart.className}</h1>
                    <span className="text-lg text-teal-700 font-normal">{formattedDateTime}</span>
                </div>

                {teacherDeskPosition === 'top' && <div className="mb-2 w-full flex justify-center"><SideItems /></div>}

                <div className="flex flex-col items-center mt-2">
                    <div className="classroom-grid inline-grid gap-x-3 gap-y-2" style={{ gridTemplateColumns: `auto repeat(${numCols}, minmax(145px, 1fr))`}}>
                        <div /> 
                        {Array.from({ length: numCols }).map((_, i) => <div key={i} className="column-header text-center font-bold text-teal-800 text-lg">טור {i + 1}</div>)}
                        
                        {Array.from({ length: maxRows }).map((_, rowIndex) => (
                            <React.Fragment key={rowIndex}>
                                <div className="row-label text-center font-bold text-teal-800 text-lg flex items-center justify-center min-w-[5rem]">שורה {teacherDeskPosition === 'bottom' ? maxRows - rowIndex : rowIndex + 1}</div>
                                {Array.from({ length: numCols }).map((_, colIndex) => {
                                    const physicalRow = rowIndex + 1;
                                    const deskCol = colIndex + 1;
                                    const rowsInThisCol = columnConfiguration[colIndex];
                                    
                                    // Calculate relative row (1 = closest to teacher)
                                    let deskRelativeRow;
                                    if (teacherDeskPosition === 'top') {
                                        deskRelativeRow = physicalRow;
                                    } else { // teacher is at the bottom
                                        deskRelativeRow = maxRows + 1 - physicalRow;
                                    }
                                    
                                    // Only render desk if it's within the configured rows for this column
                                    const shouldRenderDesk = deskRelativeRow <= rowsInThisCol;

                                    if (!shouldRenderDesk) {
                                        return <div key={colIndex} className="w-[145px] h-[80px]" aria-hidden="true"></div>; // Placeholder for empty space
                                    }

                                    const desk = desks?.find(d => d.row === deskRelativeRow && d.col === deskCol);
                                    const student1 = desk?.students.find(s => s.seat === 1);
                                    const student2 = desk?.students.find(s => s.seat === 2);
                                    
                                    const isDragOverSeat1 = dragOverInfo?.row === deskRelativeRow && dragOverInfo?.col === deskCol && dragOverInfo?.seat === 1;
                                    const isDragOverSeat2 = dragOverInfo?.row === deskRelativeRow && dragOverInfo?.col === deskCol && dragOverInfo?.seat === 2;

                                    const getIsPinned = (s: Student | undefined, seat: number) => {
                                        if (!s) return false;
                                        const c = s.constraints;
                                        // A student is pinned if they have exactly one allowed row, col, and seat that matches this position
                                        // Note: allowedRows are relative to teacher
                                        return c.allowedRows?.length === 1 && c.allowedRows[0] === deskRelativeRow &&
                                               c.allowedCols?.length === 1 && c.allowedCols[0] === deskCol &&
                                               c.allowedSeats?.length === 1 && c.allowedSeats[0] === seat;
                                    };

                                    return (
                                        <div key={colIndex} className="desk-container bg-white rounded-lg shadow-lg border-2 border-sky-400 overflow-hidden relative w-[145px] h-[80px]">
                                            <div className="seat-number absolute top-1 right-1 bg-sky-500 text-white text-[10px] font-bold rounded px-1 py-0.5 z-10">1</div>
                                            <div className="seat-number absolute top-1 left-1 bg-sky-500 text-white text-[10px] font-bold rounded px-1 py-0.5 z-10">2</div>
                                            <div className="flex h-full">
                                                <div className="w-1/2 border-l border-sky-300">
                                                    {student1 ? (
                                                        <div 
                                                            onClick={() => onEditStudent(student1.name)} 
                                                            className={`w-full h-full text-left transition-colors duration-200 cursor-pointer rounded-r-md ${isDragOverSeat1 ? 'bg-sky-200' : 'hover:bg-sky-100'}`}
                                                            draggable="true"
                                                            onDragStart={(e) => handleDragStart(e, student1.name, deskRelativeRow, deskCol, 1)}
                                                            onDragOver={(e) => handleDragOver(e, deskRelativeRow, deskCol, 1)}
                                                            onDragLeave={handleDragLeave}
                                                            onDrop={(e) => handleDropOnStudent(e, student1.name, deskRelativeRow, deskCol, 1)}
                                                            role="button"
                                                            tabIndex={0}
                                                            onKeyDown={(e) => e.key === 'Enter' && onEditStudent(student1.name)}
                                                        >
                                                            <StudentDisplay 
                                                                student={getStudentByName(student1.name)} 
                                                                isPinned={getIsPinned(getStudentByName(student1.name), 1)}
                                                                onTogglePin={onTogglePin ? (e) => { e.stopPropagation(); onTogglePin(student1.name, deskRelativeRow, deskCol, 1); } : undefined}
                                                                showConstraints={showConstraints}
                                                                seatNumber={1}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div
                                                            className={`w-full h-full flex items-center justify-center transition-colors duration-200 rounded-r-md ${isDragOverSeat1 ? 'bg-sky-200' : ''}`}
                                                            onDragOver={(e) => handleDragOver(e, deskRelativeRow, deskCol, 1)}
                                                            onDragLeave={handleDragLeave}
                                                            onDrop={(e) => handleDropOnEmpty(e, deskRelativeRow, deskCol, 1)}
                                                        >
                                                            <StudentDisplay student={null} />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="w-1/2">
                                                    {student2 ? (
                                                        <div 
                                                            onClick={() => onEditStudent(student2.name)} 
                                                            className={`w-full h-full text-left transition-colors duration-200 cursor-pointer rounded-l-md ${isDragOverSeat2 ? 'bg-sky-200' : 'hover:bg-sky-100'}`}
                                                            draggable="true"
                                                            onDragStart={(e) => handleDragStart(e, student2.name, deskRelativeRow, deskCol, 2)}
                                                            onDragOver={(e) => handleDragOver(e, deskRelativeRow, deskCol, 2)}
                                                            onDragLeave={handleDragLeave}
                                                            onDrop={(e) => handleDropOnStudent(e, student2.name, deskRelativeRow, deskCol, 2)}
                                                            role="button"
                                                            tabIndex={0}
                                                            onKeyDown={(e) => e.key === 'Enter' && onEditStudent(student2.name)}
                                                        >
                                                            <StudentDisplay 
                                                                student={getStudentByName(student2.name)} 
                                                                isPinned={getIsPinned(getStudentByName(student2.name), 2)}
                                                                onTogglePin={onTogglePin ? (e) => { e.stopPropagation(); onTogglePin(student2.name, deskRelativeRow, deskCol, 2); } : undefined}
                                                                showConstraints={showConstraints}
                                                                seatNumber={2}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div
                                                            className={`w-full h-full flex items-center justify-center transition-colors duration-200 rounded-l-md ${isDragOverSeat2 ? 'bg-sky-200' : ''}`}
                                                            onDragOver={(e) => handleDragOver(e, deskRelativeRow, deskCol, 2)}
                                                            onDragLeave={handleDragLeave}
                                                            onDrop={(e) => handleDropOnEmpty(e, deskRelativeRow, deskCol, 2)}
                                                        >
                                                            <StudentDisplay student={null} />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                {teacherDeskPosition === 'bottom' && <div className="mt-2 w-full flex justify-center"><SideItems /></div>}
                
                {showConstraints && unplacedStudents && unplacedStudents.length > 0 && (
                    <div className="mt-8 pt-4 border-t-2 border-dashed">
                        <h3 className="text-xl font-bold text-rose-600 mb-3 text-center">תלמידים שלא שובצו:</h3>
                        <div className="flex flex-wrap gap-2 justify-center">
                            {unplacedStudents.map(s => (
                                <div 
                                    key={s.name} 
                                    className="bg-rose-50 border border-rose-200 rounded-lg p-2 shadow-sm flex items-center gap-2 cursor-move"
                                    draggable="true"
                                    onDragStart={(e) => handleDragStart(e, s.name, -1, -1, -1)}
                                    title={s.reason}
                                >
                                    <div className="w-8 h-8 rounded-full bg-rose-200 flex items-center justify-center text-rose-700 font-bold">
                                        {s.name.charAt(0)}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-rose-900">{s.name}</span>
                                        <span className="text-[10px] text-rose-600 max-w-[100px] truncate">{s.reason}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ClassroomGrid;