public without sharing class AiJobRunStatusEventHandler {
    
    public static void handleCompletedJobs(Set<Id> completedJobRunIds) {
        List<AiJobRunItem> items = [
            SELECT Id, AiJobRunId, Input, Response
            FROM AiJobRunItem
            WHERE AiJobRunId IN :completedJobRunIds
            AND Status = 'Completed'
            WITH SYSTEM_MODE
        ];
        
        
        List<Movie__c> movies = new List<Movie__c>();
        for (AiJobRunItem item : items) {            
            String promptText = extractPromptResponse(item.Response);          
            if (String.isBlank(promptText)) continue;            
      
            Id movieId = extractMovieId(item.Input);         
            if (movieId == null) continue;
           
            movies.add(new Movie__c(
                Id    = movieId,
                Plot_Summary__c = promptText
            ));
        }
        if (!movies.isEmpty()) {
            update as system movies;
        }
    }
    
    
    // Input envelope: {"Input:movieRecord":{"id":"<MovieId>"}}
    private static Id extractMovieId(String inputJson) {
        if (String.isBlank(inputJson)) return null;
        try {
            Map<String, Object> parsed =
                (Map<String, Object>) JSON.deserializeUntyped(inputJson);            
            Map<String, Object> ref = (Map<String, Object>) parsed.get('Input:movieRecord');
            return ref == null ? null : (Id) String.valueOf(ref.get('id'));
        } catch (Exception ignore) {
            return null;
        }
    }
    
    
    // Response envelope: {"promptResponse":"<LLM text>"}
    private static String extractPromptResponse(String responseJson) {
        if (String.isBlank(responseJson)) return null;
        try {
            Map<String, Object> parsed =
                (Map<String, Object>) JSON.deserializeUntyped(responseJson);
            Object text = parsed.get('promptResponse');
            return text == null ? null : String.valueOf(text);
        } catch (Exception ignore) {
            return null;
        }
    }
}