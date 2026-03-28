import React, { useState } from 'react';
import { Chart, Student, GeneratedRowsLayout, Violation, GeneratedGroupsLayout, Constraints } from '../../types';
import ClassroomGrid from '../chart/ClassroomGrid';
import GroupDisplay from '../chart/GroupDisplay';
import StudentModal from '../modals/StudentModal';
import SwapConflictModal from '../modals/SwapConflictModal';
import { DEFAULT_STUDENT_CONSTRAINTS } from '../../constants';

interface ResultScreenProps {
    chart: Chart;
    onRegenerate: (chart: Chart) => void;
    onGoToEditor: () => void;
    onUpdateChart: (chart: Chart) => void;
    onClearPins?: () => void;
}

const ResultScreen: React.FC<ResultScreenProps> = ({ chart, onRegenerate, onGoToEditor, onUpdateChart, onClearPins }) => {
    const [studentToEdit, setStudentToEdit] = useState<Student | null>(null);
    const [swapConflict, setSwapConflict] = useState<{ violations: Violation[]; onConfirm: () => void } | null>(null);
    const [viewMode, setViewMode] = useState<'teacher' | 'student'>('teacher');

    if (!chart.generatedLayout) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <p className="text-lg text-slate-600 mb-4">אין מפה להצגה. נסה ליצור אחת.</p>
                <button onClick={onGoToEditor} className="py-2 px-4 bg-teal-500 text-white rounded-md hover:bg-teal-600">
                    חזרה לעריכה
                </button>
            </div>
        );
    }

    const handleOpenStudentModal = (studentName: string) => {
        const student = chart.students.find(s => s.name === studentName);
        if (student) {
            setStudentToEdit(student);
        }
    };

    const handleSaveStudent = (updatedStudent: Student) => {
        const updatedStudents = chart.students.map(s => s.id === updatedStudent.id ? updatedStudent : s);
        const updatedChart = { ...chart, students: updatedStudents };
        // Immediately regenerate the chart with the new student data for instant feedback
        onRegenerate(updatedChart);
        setStudentToEdit(null);
    };

    const handleCloseModal = () => {
        setStudentToEdit(null);
    };

    const checkStudentConstraints = (
        studentToCheck: Student,
        newPos: { row: number; col: number; seat: number },
        currentDeskMateName: string | undefined,
        allStudents: Student[]
    ): Violation[] => {
        if (newPos.row === -1) return [];
        const studentViolations: Violation[] = [];
        const constraints = { ...DEFAULT_STUDENT_CONSTRAINTS, ...(studentToCheck.constraints || {}) };
        const deskMate = allStudents.find(s => s.name === currentDeskMateName);

        if (constraints.allowedRows && constraints.allowedRows.length > 0 && !constraints.allowedRows.includes(newPos.row)) {
            studentViolations.push({ studentName: studentToCheck.name, message: `חייב להיות בשורות: ${constraints.allowedRows.join(', ')}` });
        }
        if (constraints.allowedCols && constraints.allowedCols.length > 0 && !constraints.allowedCols.includes(newPos.col)) {
            studentViolations.push({ studentName: studentToCheck.name, message: `חייב להיות בטורים: ${constraints.allowedCols.join(', ')}` });
        }
        if (constraints.allowedSeats && constraints.allowedSeats.length > 0 && !constraints.allowedSeats.includes(newPos.seat)) {
            studentViolations.push({ studentName: studentToCheck.name, message: `חייב להיות בכיסא: ${constraints.allowedSeats.join(', ')}` });
        }
        if (constraints.sitAlone && !!deskMate) {
            studentViolations.push({ studentName: studentToCheck.name, message: 'חייב לשבת לבד' });
        }
        if (deskMate && constraints.dontSitWith?.includes(deskMate.id)) {
            studentViolations.push({ studentName: studentToCheck.name, message: `אסור לשבת ליד ${deskMate.name}` });
        }
        if (constraints.sitWith && constraints.sitWith.length > 0 && (!deskMate || !constraints.sitWith.includes(deskMate.id))) {
            const requiredPartners = constraints.sitWith.map(id => allStudents.find(s => s.id === id)?.name).filter(Boolean);
            if (requiredPartners.length > 0) {
                studentViolations.push({ studentName: studentToCheck.name, message: `חייב לשבת ליד ${requiredPartners.join(', ')}` });
            }
        }
        return studentViolations;
    };
    
    const handleStudentSwap = (
        draggedInfo: { studentName: string; row: number; col: number; seat: number },
        droppedInfo: { studentName: string; row: number; col: number; seat: number }
    ) => {
        const { students, generatedLayout } = chart;
        if (!generatedLayout || !('desks' in generatedLayout)) return;

        const draggedStudent = students.find(s => s.name === draggedInfo.studentName);
        const droppedStudent = students.find(s => s.name === droppedInfo.studentName);

        if (!draggedStudent || !droppedStudent) return;

        const draggedDesk = draggedInfo.row === -1 ? null : (generatedLayout as GeneratedRowsLayout).desks.find(d => d.row === draggedInfo.row && d.col === draggedInfo.col);
        const droppedDesk = (generatedLayout as GeneratedRowsLayout).desks.find(d => d.row === droppedInfo.row && d.col === droppedInfo.col);
        
        // Correctly identify the deskmates after the swap
        // If swapping A and B in the same desk, their deskmates remain each other.
        // If swapping A and B in different desks, A's new deskmate is B's old deskmate, and vice versa.
        let draggedDeskMateName: string | undefined;
        let droppedDeskMateName: string | undefined;

        if (draggedInfo.row === droppedInfo.row && draggedInfo.col === droppedInfo.col) {
            // Same desk swap
            draggedDeskMateName = droppedInfo.studentName;
            droppedDeskMateName = draggedInfo.studentName;
        } else {
            // Different desk swap
            draggedDeskMateName = droppedDesk?.students.find(s => s.seat !== droppedInfo.seat)?.name;
            droppedDeskMateName = draggedDesk?.students.find(s => s.seat !== draggedInfo.seat)?.name;
        }

        // --- VALIDATION LOGIC ---
        const violations: Violation[] = [
            ...checkStudentConstraints(draggedStudent, droppedInfo, droppedDeskMateName, students),
            ...checkStudentConstraints(droppedStudent, draggedInfo, draggedDeskMateName, students)
        ];

        // --- SWAP LOGIC ---
        const performSwap = () => {
            const newChart = JSON.parse(JSON.stringify(chart));
            const newLayout = newChart.generatedLayout as GeneratedRowsLayout;
            
            // 1. Swap names in the visual layout
            if (draggedInfo.row === -1) {
                // From unplaced list
                const unplacedIndex = newLayout.unplacedStudents.findIndex(s => s.name === draggedInfo.studentName);
                const desk2 = newLayout.desks.find(d => d.row === droppedInfo.row && d.col === droppedInfo.col);
                const seat2 = desk2?.students.find(s => s.name === droppedInfo.studentName);
                
                if (unplacedIndex > -1 && seat2) {
                    const displacedName = seat2.name;
                    seat2.name = draggedInfo.studentName;
                    newLayout.unplacedStudents[unplacedIndex] = { name: displacedName, reason: "הוצא מהכיתה עקב החלפה ידנית" };
                }
            } else {
                const desk1 = newLayout.desks.find(d => d.row === draggedInfo.row && d.col === draggedInfo.col);
                const desk2 = newLayout.desks.find(d => d.row === droppedInfo.row && d.col === droppedInfo.col);
                if (!desk1 || !desk2) return;

                const seat1 = desk1.students.find(s => s.name === draggedInfo.studentName);
                const seat2 = desk2.students.find(s => s.name === droppedInfo.studentName);
                if (!seat1 || !seat2) return;
                seat1.name = droppedInfo.studentName;
                seat2.name = draggedInfo.studentName;
            }
            
            onUpdateChart(newChart);
            setSwapConflict(null);
        };
        
        if (violations.length > 0) {
            setSwapConflict({ violations, onConfirm: performSwap });
        } else {
            performSwap();
        }
    };

    const handleStudentMove = (
        draggedInfo: { studentName: string; row: number; col: number; seat: number },
        droppedInfo: { row: number; col: number; seat: number }
    ) => {
        const { students, generatedLayout } = chart;
        if (!generatedLayout || !('desks' in generatedLayout)) return;

        const draggedStudent = students.find(s => s.name === draggedInfo.studentName);
        if (!draggedStudent) return;

        // --- VALIDATION LOGIC ---
        const targetDesk = (generatedLayout as GeneratedRowsLayout).desks.find(d => d.row === droppedInfo.row && d.col === droppedInfo.col);
        const targetDeskMateName = targetDesk?.students.find(s => s.seat !== droppedInfo.seat)?.name;
        const violations = checkStudentConstraints(draggedStudent, droppedInfo, targetDeskMateName, students);

        // --- MOVE LOGIC ---
        const performMove = () => {
            const newChart = JSON.parse(JSON.stringify(chart));
            const newLayout = newChart.generatedLayout as GeneratedRowsLayout;
            
            // 1. Remove student from original location (desk or unplaced list)
            if (draggedInfo.row === -1) {
                // From unplaced list
                if (newLayout.unplacedStudents) {
                    const studentIndex = newLayout.unplacedStudents.findIndex(s => s.name === draggedInfo.studentName);
                    if (studentIndex > -1) {
                        newLayout.unplacedStudents.splice(studentIndex, 1);
                    }
                }
            } else {
                // From a desk
                const sourceDesk = newLayout.desks.find(d => d.row === draggedInfo.row && d.col === draggedInfo.col);
                if (sourceDesk) {
                    const studentIndex = sourceDesk.students.findIndex(s => s.name === draggedInfo.studentName);
                    if (studentIndex > -1) {
                        sourceDesk.students.splice(studentIndex, 1);
                    }
                }
            }

            // 2. Add student to new desk in layout
            let destDesk = newLayout.desks.find(d => d.row === droppedInfo.row && d.col === droppedInfo.col);
            
            // If the desk doesn't exist in the layout (shouldn't happen but for safety), create it
            if (!destDesk) {
                destDesk = { row: droppedInfo.row, col: droppedInfo.col, students: [] };
                newLayout.desks.push(destDesk);
            }

            // Ensure we don't have a student in the same seat already
            const existingSeatIndex = destDesk.students.findIndex(s => s.seat === droppedInfo.seat);
            if (existingSeatIndex > -1) {
                // This shouldn't happen if handleDropOnEmpty is used correctly, but let's be safe
                destDesk.students.splice(existingSeatIndex, 1);
            }

            destDesk.students.push({ name: draggedInfo.studentName, seat: droppedInfo.seat });

            onUpdateChart(newChart);
            setSwapConflict(null);
        };
        
        if (violations.length > 0) {
            setSwapConflict({ violations, onConfirm: performMove });
        } else {
            performMove();
        }
    };


    const handleGroupStudentSwap = (draggedStudentName: string, droppedStudentName: string) => {
        const { students, generatedLayout } = chart;
        if (!generatedLayout || !('groups' in generatedLayout)) return;

        const draggedStudent = students.find(s => s.name === draggedStudentName);
        const droppedStudent = students.find(s => s.name === droppedStudentName);
        if (!draggedStudent || !droppedStudent) return;

        const sourceGroup = (generatedLayout as GeneratedGroupsLayout).groups.find(g => g.students.includes(draggedStudentName));
        const destGroup = (generatedLayout as GeneratedGroupsLayout).groups.find(g => g.students.includes(droppedStudentName));

        if (!sourceGroup || !destGroup || sourceGroup.groupNumber === destGroup.groupNumber) return;

        const violations: Violation[] = [];
        const getStudentObj = (name: string) => students.find(s => s.name === name);

        const draggedConstraints = { ...DEFAULT_STUDENT_CONSTRAINTS, ...(draggedStudent.constraints || {}) };
        if (draggedConstraints.dontSitWith && draggedConstraints.dontSitWith.length > 0) {
            for (const studentNameInDest of destGroup.students) {
                if (studentNameInDest === droppedStudentName) continue;
                const studentInDest = getStudentObj(studentNameInDest);
                if (studentInDest && draggedConstraints.dontSitWith.includes(studentInDest.id)) {
                    violations.push({ studentName: draggedStudentName, message: `אסור להיות בקבוצה עם ${studentInDest.name}` });
                }
            }
        }

        const droppedConstraints = { ...DEFAULT_STUDENT_CONSTRAINTS, ...(droppedStudent.constraints || {}) };
        if (droppedConstraints.dontSitWith && droppedConstraints.dontSitWith.length > 0) {
            for (const studentNameInSource of sourceGroup.students) {
                if (studentNameInSource === draggedStudentName) continue;
                const studentInSource = getStudentObj(studentNameInSource);
                if (studentInSource && droppedConstraints.dontSitWith.includes(studentInSource.id)) {
                    violations.push({ studentName: droppedStudentName, message: `אסור להיות בקבוצה עם ${studentInSource.name}` });
                }
            }
        }

        const performSwap = () => {
            const newChart = JSON.parse(JSON.stringify(chart));
            const newLayout = newChart.generatedLayout as GeneratedGroupsLayout;
            
            const group1 = newLayout.groups.find(g => g.students.includes(draggedStudentName));
            const group2 = newLayout.groups.find(g => g.students.includes(droppedStudentName));
            if (!group1 || !group2) return;

            const index1 = group1.students.indexOf(draggedStudentName);
            const index2 = group2.students.indexOf(droppedStudentName);
            
            if (index1 > -1 && index2 > -1) {
                group1.students[index1] = droppedStudentName;
                group2.students[index2] = draggedStudentName;
            }

            onUpdateChart(newChart);
            setSwapConflict(null);
        };
        
        if (violations.length > 0) {
            setSwapConflict({ violations, onConfirm: performSwap });
        } else {
            performSwap();
        }
    };

    const handleTogglePin = (studentName: string, row: number, col: number, seat: number) => {
        const student = chart.students.find(s => s.name === studentName);
        if (!student) return;

        const isCurrentlyPinned = student.constraints.allowedRows?.length === 1 && 
                                 student.constraints.allowedRows[0] === row &&
                                 student.constraints.allowedCols?.length === 1 && 
                                 student.constraints.allowedCols[0] === col &&
                                 student.constraints.allowedSeats?.length === 1 && 
                                 student.constraints.allowedSeats[0] === seat;

        const newConstraints: Constraints = { ...student.constraints };

        if (isCurrentlyPinned) {
            newConstraints.allowedRows = [];
            newConstraints.allowedCols = [];
            newConstraints.allowedSeats = [];
        } else {
            newConstraints.allowedRows = [row];
            newConstraints.allowedCols = [col];
            newConstraints.allowedSeats = [seat];
        }

        const updatedStudents = chart.students.map(s => s.id === student.id ? { ...s, constraints: newConstraints } : s);
        onUpdateChart({ ...chart, students: updatedStudents });
    };

    return (
        <div className="w-full flex flex-col items-center animate-fade-in flex-grow overflow-y-auto printable-container-wrapper">
            <div className="w-full max-w-7xl px-4 py-4 flex flex-wrap justify-center gap-4 print-hidden">
                <div className="flex gap-2">
                    <button 
                        onClick={() => setViewMode('teacher')}
                        className={`py-2 px-6 rounded-lg font-bold transition-all ${viewMode === 'teacher' ? 'bg-teal-600 text-white shadow-md' : 'bg-white text-teal-700 border border-teal-200 hover:bg-teal-50'}`}
                    >
                        למורה - עם אילוצים
                    </button>
                    <button 
                        onClick={() => setViewMode('student')}
                        className={`py-2 px-6 rounded-lg font-bold transition-all ${viewMode === 'student' ? 'bg-teal-600 text-white shadow-md' : 'bg-white text-teal-700 border border-teal-200 hover:bg-teal-50'}`}
                    >
                        לתלמידים - ללא אילוצים
                    </button>
                </div>

                {viewMode === 'teacher' && onClearPins && chart.students.some(s => s.constraints.allowedRows?.length === 1) && (
                    <button 
                        onClick={onClearPins}
                        className="py-2 px-4 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg font-bold hover:bg-amber-100 transition-all flex items-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        בטל את כל הנעיצות
                    </button>
                )}
            </div>

            {chart.layoutType === 'rows' ? (
                <ClassroomGrid 
                    chart={chart} 
                    onEditStudent={handleOpenStudentModal} 
                    onStudentSwap={handleStudentSwap}
                    onStudentMove={handleStudentMove} 
                    onTogglePin={handleTogglePin}
                    showConstraints={viewMode === 'teacher'}
                />
            ) : (
                <GroupDisplay 
                    chart={chart} 
                    onEditStudent={handleOpenStudentModal} 
                    onStudentSwap={handleGroupStudentSwap} 
                    showConstraints={viewMode === 'teacher'}
                />
            )}
            {studentToEdit && (
                <StudentModal 
                    student={studentToEdit}
                    chart={chart}
                    onClose={handleCloseModal}
                    onSave={handleSaveStudent}
                />
            )}
            {swapConflict && (
                <SwapConflictModal
                    violations={swapConflict.violations}
                    onConfirm={swapConflict.onConfirm}
                    onCancel={() => setSwapConflict(null)}
                />
            )}
        </div>
    );
};

export default ResultScreen;