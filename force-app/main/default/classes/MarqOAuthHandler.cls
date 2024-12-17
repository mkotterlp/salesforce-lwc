public class MarqOAuthHandler {
  @AuraEnabled(cacheable=true)
  public static Map<String, Object> getMarqUserRecord() {
    String salesforceUserId = UserInfo.getUserId();
    HttpRequest req = new HttpRequest();
    req.setEndpoint('https://marq-salesforce.fastgenapp.com/marq-lookup');
    req.setMethod('POST');
    req.setHeader('Content-Type', 'application/json');
    req.setBody('{"salesforceuserid": "' + salesforceUserId + '"}');

    Http http = new Http();
    HttpResponse res = http.send(req);

    if (res.getStatusCode() == 200) {
      Map<String, Object> responseMap = (Map<String, Object>) JSON.deserializeUntyped(
        res.getBody()
      );
      return responseMap;
    } else {
      throw new AuraHandledException(
        'Failed to fetch user record: ' + res.getStatus()
      );
    }
  }

  @AuraEnabled(cacheable=true)
  public static Map<String, Object> deleteMarqUserRecord() {
    String salesforceUserId = UserInfo.getUserId();
    HttpRequest req = new HttpRequest();
    req.setEndpoint('https://marq-salesforce.fastgenapp.com/marq-delete-user');
    req.setMethod('POST');
    req.setHeader('Content-Type', 'application/json');
    req.setBody('{"salesforceuserid": "' + salesforceUserId + '"}');

    Http http = new Http();
    HttpResponse res = http.send(req);

    if (res.getStatusCode() == 200) {
      Map<String, Object> responseMap = (Map<String, Object>) JSON.deserializeUntyped(
        res.getBody()
      );
      return responseMap;
    } else {
      throw new AuraHandledException(
        'Failed to fetch user record: ' + res.getStatus()
      );
    }
  }

  @AuraEnabled(cacheable=true)
  public static Map<String, Object> getMarqDataRecord(String objectName) {
    String salesforceAccountId = UserInfo.getOrganizationId();
    HttpRequest req = new HttpRequest();
    req.setEndpoint('https://marq-salesforce.fastgenapp.com/marq-data-lookup');
    req.setMethod('POST');
    req.setHeader('Content-Type', 'application/json');

    Map<String, Object> payload = new Map<String, Object>{
      'objectname' => objectName,
      'salesforceaccountid' => salesforceAccountId
    };

    System.debug('Prepared payload: ' + JSON.serialize(payload));
    req.setBody(JSON.serialize(payload));

    Http http = new Http();
    HttpResponse res = http.send(req);

    if (res.getStatusCode() == 200) {
      Map<String, Object> responseMap = (Map<String, Object>) JSON.deserializeUntyped(
        res.getBody()
      );
      return responseMap;
    } else {
      throw new AuraHandledException(
        'Failed to fetch data record: ' + res.getStatus()
      );
    }
  }

  @AuraEnabled(cacheable=true)
  public static Map<String, Object> getMarqAccountRecord() {
    String salesforceAccountId = UserInfo.getOrganizationId();
    HttpRequest req = new HttpRequest();
    req.setEndpoint(
      'https://marq-salesforce.fastgenapp.com/marq-account-lookup'
    );
    req.setMethod('POST');
    req.setHeader('Content-Type', 'application/json');
    req.setBody('{"salesforceaccountid": "' + salesforceAccountId + '"}');

    Http http = new Http();
    HttpResponse res = http.send(req);

    if (res.getStatusCode() == 200) {
      Map<String, Object> responseMap = (Map<String, Object>) JSON.deserializeUntyped(
        res.getBody()
      );
      return responseMap;
    } else {
      throw new AuraHandledException(
        'Failed to fetch account record: ' + res.getStatus()
      );
    }
  }

  @AuraEnabled(cacheable=true)
  public static Map<String, Object> getSalesforceOauthRecord() {
    String salesforceAccountId = UserInfo.getOrganizationId();
    HttpRequest req = new HttpRequest();
    req.setEndpoint(
      'https://marq-salesforce.fastgenapp.com/sfdc-account-lookup'
    );
    req.setMethod('POST');
    req.setHeader('Content-Type', 'application/json');
    req.setBody('{"salesforceaccountid": "' + salesforceAccountId + '"}');

    Http http = new Http();
    HttpResponse res = http.send(req);

    if (res.getStatusCode() == 200) {
      Map<String, Object> responseMap = (Map<String, Object>) JSON.deserializeUntyped(
        res.getBody()
      );
      return responseMap;
    } else {
      throw new AuraHandledException(
        'Failed to fetch account record: ' + res.getStatus()
      );
    }
  }

  @AuraEnabled(cacheable=true)
  public static String getAuthorizationUrl(String metadataType) {
    String salesforceAccountId = UserInfo.getOrganizationId();
    String salesforceUserId = UserInfo.getUserId();

    if (
      String.isBlank(salesforceAccountId) || String.isBlank(salesforceUserId)
    ) {
      throw new AuraHandledException(
        'Salesforce Account ID or User ID is missing.'
      );
    }

    Map<String, String> payload = new Map<String, String>{
      'salesforceaccountid' => salesforceAccountId,
      'salesforceuserid' => salesforceUserId,
      'metadatatype' => metadataType
    };

    System.debug('Payload to send: ' + JSON.serialize(payload));

    Http http = new Http();
    HttpRequest request = new HttpRequest();
    request.setEndpoint(
      'https://marq-salesforce.fastgenapp.com/create-auth-url'
    );
    request.setMethod('POST');
    request.setHeader('Content-Type', 'application/json');
    request.setBody(JSON.serialize(payload));

    try {
      HttpResponse response = http.send(request);
      if (response.getStatusCode() == 200) {
        // Deserialize response body
        Map<String, Object> responseBody = (Map<String, Object>) JSON.deserializeUntyped(
          response.getBody()
        );

        // Check if 'Data' key exists and contains 'authorization_url'
        if (responseBody.containsKey('Data')) {
          Map<String, Object> data = (Map<String, Object>) responseBody.get(
            'Data'
          );
          if (data != null && data.containsKey('authorization_url')) {
            return (String) data.get('authorization_url');
          } else {
            throw new AuraHandledException(
              'Authorization URL not found in Data object.'
            );
          }
        } else {
          throw new AuraHandledException(
            'Data object not found in the response.'
          );
        }
      } else {
        throw new AuraHandledException(
          'Failed to retrieve authorization URL. Status: ' +
          response.getStatusCode()
        );
      }
    } catch (Exception e) {
      throw new AuraHandledException(
        'Error during Fastgen call: ' + e.getMessage()
      );
    }
  }

  @AuraEnabled(cacheable=true)
  public static String getSFDCAuthorizationUrl() {
    String salesforceAccountId = UserInfo.getOrganizationId();
    String salesforceUserId = UserInfo.getUserId();
    String orgUrl = URL.getOrgDomainUrl().toExternalForm();

    if (
      String.isBlank(salesforceAccountId) || String.isBlank(salesforceUserId)
    ) {
      throw new AuraHandledException(
        'Salesforce Account ID or User ID is missing.'
      );
    }

    Map<String, String> payload = new Map<String, String>{
      'salesforceaccountid' => salesforceAccountId,
      'salesforceuserid' => salesforceUserId,
      'instanceurl' => orgUrl
    };

    System.debug('Payload to send: ' + JSON.serialize(payload));

    Http http = new Http();
    HttpRequest request = new HttpRequest();
    request.setEndpoint(
      'https://marq-salesforce.fastgenapp.com/create-sfdc-auth-url'
    );
    request.setMethod('POST');
    request.setHeader('Content-Type', 'application/json');
    request.setBody(JSON.serialize(payload));

    try {
      HttpResponse response = http.send(request);
      if (response.getStatusCode() == 200) {
        // Deserialize response body
        Map<String, Object> responseBody = (Map<String, Object>) JSON.deserializeUntyped(
          response.getBody()
        );

        // Check if 'Data' key exists and contains 'authorization_url'
        if (responseBody.containsKey('Data')) {
          Map<String, Object> data = (Map<String, Object>) responseBody.get(
            'Data'
          );
          if (data != null && data.containsKey('authorization_url')) {
            return (String) data.get('authorization_url');
          } else {
            throw new AuraHandledException(
              'Authorization URL not found in Data object.'
            );
          }
        } else {
          throw new AuraHandledException(
            'Data object not found in the response.'
          );
        }
      } else {
        throw new AuraHandledException(
          'Failed to retrieve authorization URL. Status: ' +
          response.getStatusCode()
        );
      }
    } catch (Exception e) {
      throw new AuraHandledException(
        'Error during Fastgen call: ' + e.getMessage()
      );
    }
  }
}
