public with sharing class MarqTemplateFetcher {

@AuraEnabled(cacheable=true)
public static String fetchTemplates(String templatesUrl) {
    Http http = new Http();
    HttpRequest request = new HttpRequest();
    request.setEndpoint(templatesUrl);
    request.setMethod('GET');
    request.setTimeout(120000); // Set timeout to 120 seconds (2 minutes)
    
    try {
        HttpResponse response = http.send(request);
        System.debug('MarqTemplateFetcher: HTTP status code: ' + response.getStatusCode());
        System.debug('MarqTemplateFetcher: HTTP response body: ' + response.getBody());
        if (response.getStatusCode() == 200) {
            return response.getBody();
        } else {
            throw new AuraHandledException('Error fetching templates: ' + response.getStatusCode() + ' - ' + response.getStatus());
        }
    } catch (Exception e) {
        throw new AuraHandledException('Exception during HTTP callout: ' + e.getMessage());
    }
}



@AuraEnabled
public static Map<String, String> fetchAndStoreTemplates() {
    Map<String, String> resultMap = new Map<String, String>();

    String salesforceUserId = UserInfo.getUserId();
    String salesforceAccountId = UserInfo.getOrganizationId();

    // Step 1: Fetch templates from the initial endpoint
    Http http = new Http();
    HttpRequest request = new HttpRequest();
    String fetchEndpoint = 'https://marq-salesforce.fastgenapp.com/fetch-marq-templates?' + 
        'salesforceuserid=' + EncodingUtil.urlEncode(salesforceUserId, 'UTF-8') + 
        '&salesforceaccountid=' + EncodingUtil.urlEncode(salesforceAccountId, 'UTF-8');

    request.setEndpoint(fetchEndpoint);
    request.setMethod('GET'); 
    request.setTimeout(120000); // Set timeout to 2 minutes


    try {
        HttpResponse fetchResponse = http.send(request);
        System.debug('MarqTemplateFetcher: HTTP status code (fetch): ' + fetchResponse.getStatusCode());
        System.debug('MarqTemplateFetcher: HTTP response body (fetch): ' + fetchResponse.getBody());
        
        if (fetchResponse.getStatusCode() == 200) {
            // Step 2: Process the templates response
            String templatesJson = fetchResponse.getBody();
            
            // Deserialize the JSON response
            Map<String, Object> templatesMap = (Map<String, Object>) JSON.deserializeUntyped(templatesJson);
            String templatesJsonUrl = (String) templatesMap.get('templatesjsonurl');
            String lastTemplateSyncDate = (String) templatesMap.get('lasttemplatesyncdate');

            // Update result map with fetched values
            resultMap.put('templatesjsonurl', templatesJsonUrl);
            resultMap.put('lasttemplatesyncdate', lastTemplateSyncDate);
            resultMap.put('status', 'Success');
        } else {
            System.debug('MarqTemplateFetcher: Non-200 status code received (fetch): ' + fetchResponse.getStatusCode());
            resultMap.put('status', 'Failed');
            resultMap.put('error', 'Non-200 status code received (fetch): ' + fetchResponse.getStatusCode() + ', response: ' + fetchResponse.getBody());
        }
    } catch (Exception e) {
        System.debug('MarqTemplateFetcher: Exception during HTTP callout: ' + e.getMessage());
        resultMap.put('status', 'Failed');
        resultMap.put('error', 'Exception during HTTP callout: ' + e.getMessage());
    }

    return resultMap;
}



}
