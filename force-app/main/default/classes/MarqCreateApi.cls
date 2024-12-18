public with sharing class MarqCreateApi {
  @AuraEnabled
  public static Map<String, Object> createProject(
    String recordId,
    String templateId,
    String templateTitle,
    String objectName,
    String template_title_primary,
    String template_title_secondary
  ) {
    Map<String, Object> result = new Map<String, Object>();

    String salesforceAccountId = UserInfo.getOrganizationId();
    String salesforceUserId = UserInfo.getUserId();

    try {
      // Prepare the HTTP request
      Http http = new Http();
      HttpRequest request = new HttpRequest();
      request.setEndpoint(
        'https://marq-salesforce.fastgenapp.com/create-marq-project'
      );
      request.setMethod('POST');
      request.setHeader('Content-Type', 'application/json');
      request.setTimeout(120000); // Set timeout to 2 minutes

      // Prepare the request body
      Map<String, String> requestBody = new Map<String, String>();
      requestBody.put('recordid', recordId);
      requestBody.put('templateid', templateId);
      requestBody.put('templatetitle', templateTitle);
      requestBody.put('objecttype', objectName);
      requestBody.put('salesforceaccountid', salesforceAccountId);
      requestBody.put('salesforceuserid', salesforceUserId);
      requestBody.put('template_title_primary', template_title_primary);
      requestBody.put('template_title_secondary', template_title_secondary);

      String serializedRequestBody = JSON.serialize(requestBody);
      request.setBody(serializedRequestBody);

      // Log the request payload for debugging
      System.debug('Request Payload: ' + serializedRequestBody);

      // Send the HTTP request
      HttpResponse response = http.send(request);

      // Log the HTTP response
      System.debug('HTTP Response Status: ' + response.getStatusCode());
      System.debug('HTTP Response Body: ' + response.getBody());

      // Check for a successful response
      if (response.getStatusCode() == 200) {
        Map<String, Object> responseBody = (Map<String, Object>) JSON.deserializeUntyped(
          response.getBody()
        );

        if (responseBody.containsKey('documentid')) {
          result.put('documentid', responseBody.get('documentid'));
          result.put('project_info', responseBody.get('project_info')); // Get the project_info
          result.put('success', true);
          return result;
        } else {
          throw new CalloutException(
            'Document ID not found in response: ' + response.getBody()
          );
        }
      } else {
        // Handle non-200 response
        System.debug('Error Response Body: ' + response.getBody());
        throw new CalloutException(
          'Error creating project: ' +
            response.getStatusCode() +
            ' - ' +
            response.getBody()
        );
      }
    } catch (Exception e) {
      System.debug('Exception during HTTP callout: ' + e.getMessage());
      throw new AuraHandledException(
        'Exception during HTTP callout: ' + e.getMessage()
      );
    }
  }
}
