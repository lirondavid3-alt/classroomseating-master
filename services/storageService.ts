
import { Chart } from '../types';
import { db, auth } from './firebase';
import { doc, getDoc, setDoc, collection, getDocs, query, onSnapshot } from "firebase/firestore";

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export class FirestoreQuotaError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'FirestoreQuotaError';
    }
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  // Check for quota exceeded error
  if (errorMessage.toLowerCase().includes('quota') || errorMessage.toLowerCase().includes('resource-exhausted')) {
      console.error('Firestore Quota Exceeded:', errorMessage);
      throw new FirestoreQuotaError(errorMessage);
  }

  const errInfo: FirestoreErrorInfo = {
    error: errorMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Helper to fallback to localStorage if Firebase isn't configured yet
const isFirebaseReady = () => !!db;

export const saveUserCharts = async (email: string, charts: Chart[], credits?: number, isSubscribed?: boolean, role?: 'admin' | 'user'): Promise<void> => {
    if (!email) return;

    // Always save to localStorage as a backup
    try {
        localStorage.setItem(`seatingApp_charts_${email}`, JSON.stringify(charts));
        if (credits !== undefined) localStorage.setItem(`seatingApp_credits_${email}`, String(credits));
        if (isSubscribed !== undefined) localStorage.setItem(`seatingApp_isSubscribed_${email}`, String(isSubscribed));
        if (role !== undefined) localStorage.setItem(`seatingApp_role_${email}`, role);
        localStorage.setItem(`seatingApp_lastUpdated_${email}`, new Date().toISOString());
    } catch (error) {
        console.error('Failed to save charts locally:', error);
    }

    if (!isFirebaseReady()) {
        console.warn("Firebase not configured, saved to localStorage only");
        return;
    }

    const path = `users/${email}`;
    try {
        const updateData: any = { 
            charts: JSON.stringify(charts),
            lastUpdated: new Date().toISOString()
        };
        if (credits !== undefined) updateData.credits = credits;
        if (isSubscribed !== undefined) updateData.isSubscribed = isSubscribed;
        if (role !== undefined) updateData.role = role;

        await setDoc(doc(db, "users", email), updateData, { merge: true });
    } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
    }
};

export interface UserProfileData {
    charts: Chart[];
    credits: number;
    isSubscribed: boolean;
    role: 'admin' | 'user';
    isFrozen?: boolean;
}

export const loadUserProfile = async (email: string): Promise<UserProfileData> => {
    if (!email) return { charts: [], credits: 10, isSubscribed: false, role: 'user' };

    const getLocalData = (): UserProfileData => {
        const localCharts = localStorage.getItem(`seatingApp_charts_${email}`);
        const localCredits = localStorage.getItem(`seatingApp_credits_${email}`);
        const localSub = localStorage.getItem(`seatingApp_isSubscribed_${email}`);
        const localRole = localStorage.getItem(`seatingApp_role_${email}`) as 'admin' | 'user';
        
        return {
            charts: localCharts ? JSON.parse(localCharts) : [],
            credits: localCredits ? parseInt(localCredits) : 10,
            isSubscribed: localSub === 'true',
            role: localRole || 'user',
            isFrozen: localStorage.getItem(`seatingApp_isFrozen_${email}`) === 'true'
        };
    };

    if (!isFirebaseReady()) {
        console.warn("Firebase not configured, loading from localStorage");
        try {
            return getLocalData();
        } catch (error) {
            console.error('Failed to load profile locally:', error);
            return { charts: [], credits: 10, isSubscribed: false, role: 'user' };
        }
    }

    const path = `users/${email}`;
    try {
        const docRef = doc(db, "users", email);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            let charts: Chart[] = [];
            if (data.charts) {
                charts = typeof data.charts === 'string' ? JSON.parse(data.charts) : data.charts;
            }
            
            // Compare with local data - if local is newer, we might want to use it
            // but for now let's stick to Firestore as source of truth if available
            const credits = data.credits !== undefined ? data.credits : 10;
            const isSubscribed = data.isSubscribed !== undefined ? data.isSubscribed : false;
            const role = data.role || 'user';
            const isFrozen = !!data.isFrozen;

            return { charts, credits, isSubscribed, role, isFrozen };
        } else {
            // New user or no data in Firestore, try local
            const local = getLocalData();
            if (local.charts.length > 0) {
                return local;
            }
            
            // New user initialization
            const initialData = { charts: "[]", credits: 10, isSubscribed: false, role: 'user', isFrozen: false, lastUpdated: new Date().toISOString() };
            await setDoc(docRef, initialData);
            return { charts: [], credits: 10, isSubscribed: false, role: 'user', isFrozen: false };
        }
    } catch (error) {
        if (error instanceof FirestoreQuotaError) {
            console.warn("Quota exceeded, falling back to local data");
            return getLocalData();
        }
        handleFirestoreError(error, OperationType.GET, path);
        return getLocalData();
    }
};

export const updateUserAdminFields = async (email: string, credits: number, isSubscribed: boolean, role: 'admin' | 'user', isFrozen?: boolean): Promise<void> => {
    if (!email || !isFirebaseReady()) return;

    const path = `users/${email}`;
    try {
        await setDoc(doc(db, "users", email), { 
            credits, 
            isSubscribed, 
            role,
            isFrozen: !!isFrozen,
            lastUpdated: new Date().toISOString()
        }, { merge: true });
    } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
    }
};

export const deleteUserAccount = async (email: string): Promise<void> => {
    if (!email || !isFirebaseReady()) return;
    
    const path = `users/${email}`;
    try {
        // In a real app, we might want to use a cloud function to delete all data
        // For now, we'll delete the user document in Firestore
        const { deleteDoc } = await import("firebase/firestore");
        await deleteDoc(doc(db, "users", email));
        
        // Also clear local storage for this user
        localStorage.removeItem(`seatingApp_charts_${email}`);
        localStorage.removeItem(`seatingApp_credits_${email}`);
        localStorage.removeItem(`seatingApp_isSubscribed_${email}`);
        localStorage.removeItem(`seatingApp_role_${email}`);
        localStorage.removeItem(`seatingApp_isFrozen_${email}`);
        localStorage.removeItem(`seatingApp_lastUpdated_${email}`);
    } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
    }
};

export interface AdminUserRecord {
    email: string;
    credits: number;
    isSubscribed: boolean;
    role: 'admin' | 'user';
    isFrozen: boolean;
    lastUpdated: string;
}

export const listAllUsers = async (): Promise<AdminUserRecord[]> => {
    if (!isFirebaseReady()) return [];

    const path = 'users';
    try {
        const q = query(collection(db, "users"));
        const querySnapshot = await getDocs(q);
        const users: AdminUserRecord[] = [];
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            users.push({
                email: doc.id,
                credits: data.credits || 0,
                isSubscribed: !!data.isSubscribed,
                role: data.role || 'user',
                isFrozen: !!data.isFrozen,
                lastUpdated: data.lastUpdated || ''
            });
        });
        
        return users;
    } catch (error) {
        handleFirestoreError(error, OperationType.LIST, path);
        return [];
    }
};
