public with sharing class MarqDataSender {
  @AuraEnabled(cacheable=true)
  public static Account getAccount(String accountId) {
    return [
      SELECT Id, Name, Industry, Logo_URL__c
      FROM Account
      WHERE Id = :accountId
      LIMIT 1
    ];
  }

  @AuraEnabled
  public static List<OpportunityLineItem> getProductsByOpportunityId(
    Id opportunityId
  ) {
    Boolean multiCurrencyEnabled = UserInfo.isMultiCurrencyOrganization();

    String baseQuery = 'SELECT Id, Quantity, UnitPrice, ServiceDate, PricebookEntry.Product2.Name';

    if (multiCurrencyEnabled) {
      baseQuery += ', CurrencyIsoCode';
    }

    baseQuery += ' FROM OpportunityLineItem WHERE OpportunityId = :opportunityId';

    return Database.query(baseQuery);
  }

  @AuraEnabled(cacheable=true)
  public static String getAccountLogo(Id opportunityId) {
    // Query to get the Account Logo URL based on the Opportunity's AccountId
    try {
      Opportunity opp = [
        SELECT AccountId
        FROM Opportunity
        WHERE Id = :opportunityId
        LIMIT 1
      ];

      if (opp.AccountId != null) {
        Account acc = [
          SELECT Logo_URL__c
          FROM Account
          WHERE Id = :opp.AccountId
          LIMIT 1
        ];

        // Return the Logo URL if it exists
        if (acc.Logo_URL__c != null) {
          return acc.Logo_URL__c;
        } else {
          return 'No logo URL found';
        }
      } else {
        return 'No Account associated with this Opportunity';
      }
    } catch (Exception e) {
      // Handle any errors that occur during the query
      System.debug('Error fetching Account Logo: ' + e.getMessage());
      return 'Error: ' + e.getMessage();
    }
  }

  private static List<Map<String, Object>> queryParentRecords(
    Id parentRecordId,
    String parentObjectName,
    List<String> fieldNames
  ) {
    List<String> queryFields = new List<String>();
    Map<String, String> relationshipFieldMap = new Map<String, String>();

    // Debug incoming parameters
    System.debug('Incoming parentRecordId: ' + parentRecordId);
    System.debug('Incoming parentObjectName: ' + parentObjectName);
    System.debug('Incoming fieldNames: ' + fieldNames);

    // Check for relationships in fieldNames and build relationshipFieldMap
    for (String fieldName : fieldNames) {
      if (fieldName.contains('.')) {
        String[] parts = fieldName.split('\\.');
        String relationship = parts[0]; // e.g., 'Account' in 'Account.Name'
        String relatedField = parts[1]; // e.g., 'Name' in 'Account.Name'

        if (!relationshipFieldMap.containsKey(relationship)) {
          relationshipFieldMap.put(
            relationship,
            relationship + '.' + relatedField
          );
        } else {
          relationshipFieldMap.put(
            relationship,
            relationshipFieldMap.get(relationship) +
              ', ' +
              relationship +
              '.' +
              relatedField
          );
        }
      } else {
        queryFields.add(fieldName); // Non-relationship fields
      }
    }

    // Debug the built maps
    System.debug('Non-relationship fields: ' + queryFields);
    System.debug('Relationship fields map: ' + relationshipFieldMap);

    // Build the SOQL query string
    String queryString = 'SELECT ' + String.join(queryFields, ', ');
    for (String relationship : relationshipFieldMap.keySet()) {
      queryString += ', ' + relationshipFieldMap.get(relationship);
    }
    queryString += ' FROM ' + parentObjectName + ' WHERE Id = :parentRecordId';

    // Debug the final query string
    System.debug('Final Query String: ' + queryString);

    // Execute the query
    List<SObject> records = Database.query(queryString);

    // Debug the query results
    System.debug('Query Results: ' + records);

    // Convert the records to a list of maps
    List<Map<String, Object>> resultMaps = sObjectsToMapList(
      records,
      queryFields
    );

    // Debug the final mapped results
    System.debug('Final Mapped Results: ' + resultMaps);

    // Check field accessibility
    for (String fieldName : fieldNames) {
      Schema.DescribeFieldResult fieldResult = Schema.getGlobalDescribe()
        .get(parentObjectName)
        .getDescribe()
        .fields.getMap()
        .get(fieldName)
        .getDescribe();
      if (fieldResult.isAccessible()) {
        System.debug('Field ' + fieldName + ' is accessible');
      } else {
        System.debug('Field ' + fieldName + ' is NOT accessible');
      }
    }

    return resultMaps;
  }

  private static List<Map<String, Object>> queryRelatedObjectRecords(
    Id parentRecordId,
    String parentObjectName,
    String relatedObjectName,
    List<String> fieldNames
  ) {
    String queryString =
      'SELECT ' +
      String.join(fieldNames, ', ') +
      ' FROM ' +
      relatedObjectName +
      ' WHERE ' +
      parentObjectName +
      'Id = :parentRecordId';

    System.debug('Query String: ' + queryString);

    List<SObject> records = Database.query(queryString);
    return sObjectsToMapList(records, fieldNames);
  }

  @AuraEnabled(cacheable=true)
  public static Map<String, List<Map<String, Object>>> getRelatedRecords(
    Id parentRecordId,
    List<String> customFields
  ) {
    Map<String, List<Map<String, Object>>> relatedRecordsMap = new Map<String, List<Map<String, Object>>>();
    Map<String, Set<String>> objectFieldMap = new Map<String, Set<String>>();
    Map<String, String> relationshipMap = new Map<String, String>();

    for (String fullField : customFields) {
      fullField = fullField.trim();

      String[] parts = fullField.split('\\.');

      if (parts.size() == 2) {
        String objectName = parts[0];
        String fieldName = parts[1];

        if (!objectFieldMap.containsKey(objectName)) {
          objectFieldMap.put(objectName, new Set<String>());
        }

        objectFieldMap.get(objectName).add(fieldName);
      } else if (parts.size() == 3) {
        String parentObjectName = parts[0];
        String relatedObjectName = parts[1];
        String fieldName = parts[2];

        if (!objectFieldMap.containsKey(relatedObjectName)) {
          objectFieldMap.put(relatedObjectName, new Set<String>());
        }

        objectFieldMap.get(relatedObjectName).add(fieldName);
        relationshipMap.put(relatedObjectName, parentObjectName);
      } else {
        System.debug('Unexpected number of parts for field: ' + fullField);
      }
    }

    for (String objectName : objectFieldMap.keySet()) {
      List<String> fieldNames = new List<String>(
        objectFieldMap.get(objectName)
      );
      List<Map<String, Object>> records = new List<Map<String, Object>>();

      if (relationshipMap.containsKey(objectName)) {
        String parentObjectName = relationshipMap.get(objectName);
        records = queryRelatedObjectRecords(
          parentRecordId,
          parentObjectName,
          objectName,
          fieldNames
        );
      } else {
        records = queryParentRecords(parentRecordId, objectName, fieldNames);
      }

      relatedRecordsMap.put(objectName, records);
    }

    return relatedRecordsMap;
  }

  private static List<Map<String, Object>> sObjectsToMapList(
    List<SObject> records,
    List<String> fieldNames
  ) {
    List<Map<String, Object>> recordMaps = new List<Map<String, Object>>();

    for (SObject record : records) {
      Map<String, Object> recordMap = new Map<String, Object>();
      for (String fieldName : fieldNames) {
        try {
          Object fieldValue = record.get(fieldName);
          if (fieldValue != null) {
            recordMap.put(fieldName, fieldValue);
          }
        } catch (Exception e) {
          // Handle the case where the field might not exist on the SObject
          System.debug(
            'Field ' +
              fieldName +
              ' does not exist on ' +
              record.getSObjectType().getDescribe().getName()
          );
        }
      }
      recordMaps.add(recordMap);
    }

    return recordMaps;
  }

  @AuraEnabled(cacheable=true)
  public static List<Map<String, Object>> fetchCustomData(String query) {
    List<Map<String, Object>> results = new List<Map<String, Object>>();
    try {
      List<SObject> records = Database.query(query);
      for (SObject record : records) {
        Map<String, Object> recordMap = new Map<String, Object>();
        for (
          Schema.SObjectField field : record.getSObjectType()
            .getDescribe()
            .fields.getMap()
            .values()
        ) {
          String fieldName = field.getDescribe().getName();
          recordMap.put(fieldName, record.get(fieldName));
        }
        results.add(recordMap);
      }
    } catch (Exception e) {
      throw new AuraHandledException(
        'Error executing query: ' + e.getMessage()
      );
    }
    return results;
  }

  @AuraEnabled
  public static void sendDataToEndpoint(
    String objectName,
    Map<String, Object> properties,
    List<Map<String, Object>> schema
  ) {
    String salesforceAccountId = UserInfo.getOrganizationId();
    String salesforceUserId = UserInfo.getUserId();

    Http http = new Http();
    HttpRequest request = new HttpRequest();

    // Set up the HTTP request
    request.setEndpoint(
      'https://marq-salesforce.fastgenapp.com/update-marq-data'
    );
    request.setMethod('POST');
    request.setHeader('Content-Type', 'application/json');

    Map<String, Object> dataPayload = new Map<String, Object>{
      'objectname' => objectName,
      'salesforceaccountid' => salesforceAccountId,
      'properties' => properties,
      'schema' => schema
    };

    System.debug('Prepared dataPayload: ' + JSON.serialize(dataPayload));

    request.setBody(JSON.serialize(dataPayload));

    try {
      HttpResponse response = http.send(request);
      System.debug('HTTP Response Status: ' + response.getStatusCode());
      System.debug('HTTP Response Body: ' + response.getBody());

      if (response.getStatusCode() != 200) {
        throw new CalloutException(
          'Failed to send data: ' + response.getBody()
        );
      }

      // Parse the response to update the refresh token if present
      Map<String, Object> responseMap = (Map<String, Object>) JSON.deserializeUntyped(
        response.getBody()
      );
    } catch (Exception e) {
      System.debug(
        'Exception while sending data: ' +
          e.getMessage() +
          ', Stack Trace: ' +
          e.getStackTraceString()
      );
      throw new AuraHandledException('Error sending data: ' + e.getMessage());
    }
  }

  @AuraEnabled
  public static String createDataset(
    String objectName,
    List<Map<String, Object>> schema
  ) {
    String salesforceAccountId = UserInfo.getOrganizationId();
    String salesforceUserId = UserInfo.getUserId();

    Http http = new Http();
    HttpRequest request = new HttpRequest();
    request.setEndpoint(
      'https://marq-salesforce.fastgenapp.com/create-marq-dataset'
    );
    request.setMethod('POST');
    request.setHeader('Content-Type', 'application/json');

    Map<String, Object> calloutPayload = new Map<String, Object>{
      'objectName' => objectName,
      'schema' => schema,
      'salesforceaccountid' => salesforceAccountId,
      'salesforceuserid' => salesforceUserId
    };

    System.debug('Prepared callout payload: ' + JSON.serialize(calloutPayload));

    request.setBody(JSON.serialize(calloutPayload));

    try {
      HttpResponse response = http.send(request);
      System.debug('HTTP Response Status: ' + response.getStatusCode());
      System.debug('HTTP Response Body: ' + response.getBody());

      if (response.getStatusCode() != 200) {
        throw new AuraHandledException(
          'Failed to create dataset: ' + response.getBody()
        );
      }

      // Assuming a successful response, return a success message
      return 'Dataset created successfully: ' + response.getBody();
    } catch (Exception e) {
      System.debug('Exception while creating dataset: ' + e.getMessage());
      throw new AuraHandledException(
        'Exception while creating dataset: ' + e.getMessage()
      );
    }
  }
}
