

export interface User {
    email: string;
    name: string;
    picture: string | null;
    credits: number;
    isSubscribed: boolean;
    role: 'admin' | 'user';
    isFrozen?: boolean;
}

export interface Constraints {
    allowedRows: number[] | null;
    allowedCols: number[] | null;
    allowedSeats: number[] | null; // Can contain 1 or 2
    sitAlone: boolean;
    sitWith: string[];
    dontSitWith: string[];
}

export interface Student {
    id: string;
    name: string;
    picture?: string;
    gender: 'זכר' | 'נקבה' | '';
    ratings: { [subject: string]: number };
    academicLevel?: number; // 1-5
    behaviorLevel?: number; // 1-5
    constraints: Constraints;
}

export interface LevelConsiderationOptions {
    balanced: boolean;
    strong_weak_neighbor: boolean;
    challenge_at_edges: boolean;
}

export interface RowsLayoutDetails {
    columnConfiguration: number[];
    // Old properties - kept optional for migration
    rows?: number;
    cols?: number;
    
    teacherDeskPosition: 'top' | 'bottom';
    windowPosition: 'left' | 'right';
    doorPosition: 'left' | 'right';
    genderArrangement?: 'gender_random' | 'gender_mixed' | 'gender_same';
    levelConsideration?: LevelConsiderationOptions;
}

export interface GroupsLayoutDetails {
    groups: number;
}

export type LayoutDetails = RowsLayoutDetails | GroupsLayoutDetails;

export interface Desk {
    row: number;
    col: number;
    students: { name: string; seat: number }[];
}

export interface Group {
    groupNumber: number;
    students: string[];
    level?: number;
}

export interface UnplacedStudentInfo {
    name: string;
    reason: string;
}

export interface GeneratedRowsLayout {
    desks: Desk[];
    unplacedStudents: UnplacedStudentInfo[];
}

export interface GeneratedGroupsLayout {
    groups: Group[];
    unplacedStudents: UnplacedStudentInfo[];
}

export type GeneratedLayout = GeneratedRowsLayout | GeneratedGroupsLayout;

export interface Chart {
    id: string;
    className: string;
    creationDate: string;
    layoutType: 'rows' | 'groups';
    layoutDetails: LayoutDetails;
    students: Student[];
    generatedLayout: GeneratedLayout | null;
    // Add these for version history during editing session
    layoutHistory?: GeneratedLayout[];
    activeLayoutIndex?: number;
}

export type Screen = 'login' | 'main' | 'editor' | 'result' | 'loading' | 'admin';

export interface Violation {
    studentName: string;
    message: string;
}