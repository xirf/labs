import { ref } from "vue";

export interface ActivityLog {
    id: number;         // Unique ID for the log entry
    type: 'found'       // Type of activity
    | 'transaction'
    | 'mining'
    | 'contract'
    | 'network'
    | 'error'
    | 'info'
    | 'consensus'
    | 'governance'
    | 'validation'
    | 'peer';
    message: string;     // Description of the activity
    timestamp: number;   // Unix timestamp of when the activity occurred
}

export const activityLogs = ref<ActivityLog[]>([]); // Array to hold activity logs

export const addActivityLog = (type: ActivityLog['type'], message: string) => {
    let logId = activityLogs.value.length > 0 ? activityLogs.value[activityLogs.value.length - 1].id : 0;
    activityLogs.value.push({
        id: ++logId,
        type,
        message,
        timestamp: Date.now()
    })

    // Keep only last 100 logs
    if (activityLogs.value.length > 100) {
        activityLogs.value = activityLogs.value.slice(-100)
    }
}

export const clearActivityLogs = () => {
    activityLogs.value = []
}