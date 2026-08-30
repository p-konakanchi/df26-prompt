public without sharing class PromptTemplateBatchGen {
    
    public static void submitBatch() {
        
        AiJobRun jobRun = new AiJobRun(
            JobType = 'PromptTemplate',
            Target  = 'Generate_Plot_Summary', // prompt template DeveloperName (Id also accepted)
            Status  = 'New'
        );
        insert as user jobRun;
        
        List<Movie__c> movies = [SELECT Id FROM Movie__c where Recently_Created__c = true];
        
        List<AiJobRunItem> items = new List<AiJobRunItem>();
        for (Movie__c m : movies) {
            Map<String, Object> payload = new Map<String, Object>{
                'Input:movieRecord' => new Map<String, Object>{ 'id' => m.Id }
            };
                items.add(new AiJobRunItem(
                    AiJobRunId = jobRun.Id,
                    Status     = 'Ready',
                    Input      = JSON.serialize(payload)
                ));
        }
        insert as user items;
        
        jobRun.Status = 'ReadyToStart';
        update as user jobRun;
        
    }
    
    
    
}