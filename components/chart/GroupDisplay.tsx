import React, { useState } from 'react';
import { Chart, GeneratedGroupsLayout, Student } from '../../types';
import { UserIcon, MaleIcon, FemaleIcon } from '../icons';

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

interface GroupDisplayProps {
    chart: Chart;
    onEditStudent: (studentName: string) => void;
    onStudentSwap: (draggedStudentName: string, droppedStudentName: string) => void;
    showConstraints?: boolean;
}

const GroupDisplay: React.FC<GroupDisplayProps> = ({ chart, onEditStudent, onStudentSwap, showConstraints = true }) => {
    const { generatedLayout } = chart;
    const { groups, unplacedStudents } = generatedLayout as GeneratedGroupsLayout;
    const [dragOverStudent, setDragOverStudent] = useState<string | null>(null);
    
    if (!groups) {
        return <div className="text-center p-8"><p className="text-lg text-red-600">שגיאה: לא נמצאו קבוצות</p></div>;
    }

    const handleDragStart = (e: React.DragEvent<HTMLButtonElement>, studentName: string) => {
        e.dataTransfer.setData('studentName', studentName);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent<HTMLButtonElement>, studentName: string) => {
        e.preventDefault();
        setDragOverStudent(studentName);
    };

    const handleDragLeave = () => {
        setDragOverStudent(null);
    };

    const handleDrop = (e: React.DragEvent<HTMLButtonElement>, droppedStudentName: string) => {
        e.preventDefault();
        setDragOverStudent(null);
        const draggedStudentName = e.dataTransfer.getData('studentName');
        
        if (draggedStudentName && draggedStudentName !== droppedStudentName) {
            onStudentSwap(draggedStudentName, droppedStudentName);
        }
    };


    const groupColors = ['border-sky-400', 'border-teal-400', 'border-amber-400', 'border-rose-400', 'border-indigo-400'];

    const formattedDateTime = new Date(chart.creationDate).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', ' ');

    return (
        <div className="w-full max-w-7xl mx-auto p-4">
            <div id="printable-area" className="p-6 bg-white rounded-lg shadow-lg w-fit mx-auto">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-slate-800">{chart.className}</h1>
                    <h2 className="text-xl text-slate-500">{formattedDateTime}</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 groups-grid">
                    {groups.sort((a,b) => a.groupNumber - b.groupNumber).map(group => (
                        <div key={group.groupNumber} className={`bg-white rounded-lg shadow-md p-6 border-t-4 ${groupColors[(group.groupNumber - 1) % groupColors.length]}`}>
                            <h3 className="text-2xl font-bold mb-4 text-slate-700">
                                קבוצה {group.groupNumber}
                                {group.level && <span className="text-lg font-normal text-slate-500 mr-2">(רמה {group.level})</span>}
                            </h3>
                            <ul className="space-y-3">
                                {group.students.map(name => {
                                    const student = chart.students.find(s => s.name === name);
                                    if (!student) return null;
                                    const genderColor = student.gender === 'זכר' ? 'text-sky-600' : student.gender === 'נקבה' ? 'text-pink-500' : 'text-slate-800';
                                    return (
                                        <li key={name}>
                                            <button 
                                                onClick={() => onEditStudent(name)} 
                                                className={`w-full flex items-center bg-slate-50 p-3 rounded-md shadow-sm text-right hover:bg-sky-100 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-sky-500 ${dragOverStudent === name ? 'bg-sky-200 ring-2 ring-sky-500 scale-105' : ''}`}
                                                draggable="true"
                                                onDragStart={(e) => handleDragStart(e, name)}
                                                onDragOver={(e) => handleDragOver(e, name)}
                                                onDragLeave={handleDragLeave}
                                                onDrop={(e) => handleDrop(e, name)}
                                            >
                                                {student.picture ? <img src={student.picture} alt={name} className="w-12 h-12 rounded-full object-cover mr-3"/> : <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center mr-3 flex-shrink-0"><UserIcon className='w-7 h-7 text-gray-500' /></div>}
                                                <div className="flex flex-col items-start flex-grow">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`${genderColor} font-medium text-lg`}>{name}</span>
                                                        {student.gender === 'זכר' && <MaleIcon title="זכר" className="h-5 w-5 text-sky-500" />}
                                                        {student.gender === 'נקבה' && <FemaleIcon title="נקבה" className="h-5 w-5 text-pink-500" />}
                                                    </div>
                                                    <div className="flex flex-col gap-1 mt-1.5 items-start">
                                                        {showConstraints && student.academicLevel && <RatingIndicator type="academic" level={student.academicLevel} />}
                                                        {showConstraints && student.behaviorLevel && <RatingIndicator type="behavior" level={student.behaviorLevel} />}
                                                    </div>
                                                </div>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                </div>
                {showConstraints && unplacedStudents && unplacedStudents.length > 0 && (
                    <div className="mt-8 pt-4 border-t-2 border-dashed">
                        <h3 className="text-xl font-bold text-rose-600 mb-3 text-center">תלמידים שלא שובצו:</h3>
                        <ul className="list-disc list-inside text-right max-w-2xl mx-auto space-y-1">
                           {unplacedStudents.map(s => (
                                <li key={s.name} className="text-slate-700">
                                    <strong className="font-semibold text-slate-800">{s.name}:</strong> {s.reason}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GroupDisplay;