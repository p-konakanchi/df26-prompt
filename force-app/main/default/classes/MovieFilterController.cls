public with sharing class MovieFilterController {

    @AuraEnabled(cacheable=true)
    public static List<String> getGenreOptions() {
        List<String> genres = new List<String>();
        Schema.DescribeFieldResult describeResult =
            Movie__c.Genre__c.getDescribe();
        for (Schema.PicklistEntry entry : describeResult.getPicklistValues()) {
            if (entry.isActive()) {
                genres.add(entry.getValue());
            }
        }
        return genres;
    }

    @AuraEnabled(cacheable=true)
    public static List<Movie__c> findMovies(Integer minYear, List<String> genres) {
        String query = 'SELECT Id, Name, Year__c, Genre__c, Plot_Summary__c, ' +
            'Poster_Link__c FROM Movie__c';

        List<String> conditions = new List<String>();
        List<Object> bindArgs = new List<Object>();
        Integer bindIndex = 0;

        if (minYear != null) {
            conditions.add('Year__c >= :bind' + bindIndex);
            bindArgs.add(minYear);
            bindIndex++;
        }
        if (genres != null && !genres.isEmpty()) {
            conditions.add('Genre__c IN :bind' + bindIndex);
            bindArgs.add(genres);
            bindIndex++;
        }
        if (!conditions.isEmpty()) {
            query += ' WHERE ' + String.join(conditions, ' AND ');
        }
        query += ' ORDER BY Name LIMIT 50';

        Map<String, Object> bindMap = new Map<String, Object>();
        for (Integer i = 0; i < bindArgs.size(); i++) {
            bindMap.put('bind' + i, bindArgs[i]);
        }

        return Database.queryWithBinds(query, bindMap, AccessLevel.USER_MODE);
    }
}