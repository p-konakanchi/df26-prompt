trigger AiJobRunStatusEventTrigger on AiJobRunStatusEvent (after insert) {
    
    Set<Id> completedJobRunIds = new Set<Id>();
    for (AiJobRunStatusEvent e : Trigger.new) {
        if (e.Status == 'Completed' && String.isNotBlank(e.AiJobRunIdentifier)) {
            completedJobRunIds.add((Id) e.AiJobRunIdentifier);
        }
    }
    if (!completedJobRunIds.isEmpty()) {
        try {
            AiJobRunStatusEventHandler.handleCompletedJobs(completedJobRunIds);
        } catch (Exception ex) {
            // Swallow and log. An uncaught exception fails the batch of events, and after
            // 9 retries the platform disables the subscription — killing all future delivery.
            System.debug(LoggingLevel.ERROR,
                'AiJobRunStatusEventTrigger failed for ' + completedJobRunIds +
                ': ' + ex.getTypeName() + ': ' + ex.getMessage());
        }
    }
}