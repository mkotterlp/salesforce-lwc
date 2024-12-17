public with sharing class MarqembedController {
  @AuraEnabled
  public static String saveAsFileAndUpdateRecord(
    String recordId,
    String downloadUrl,
    String projectName,
    String mimeType,
    String projectId,
    String encodedOptions,
    String templateId
  ) {
    System.debug(
      'saveAsFileAndUpdateRecord called with: recordId=' +
        recordId +
        ', downloadUrl=' +
        downloadUrl +
        ', projectName=' +
        projectName +
        ', mimeType=' +
        mimeType +
        ', templateId=' +
        templateId
    );

    // Identify the object type
    String objectAPIName = findObjectAPIName(recordId);
    if (objectAPIName == null) {
      throw new AuraHandledException(
        'Object not found for record ID: ' + recordId
      );
    }

    // Check if the object is a Quote and handle PDF generation
    if (objectAPIName == 'Quote') {
      return handleQuotePDFUpload(
        recordId,
        downloadUrl,
        projectName,
        projectId,
        encodedOptions
      );
    }

    // Existing functionality for other operations
    return handleFileDownload(
      recordId,
      downloadUrl,
      projectName,
      mimeType,
      projectId,
      encodedOptions,
      templateId
    );
  }

  @AuraEnabled(cacheable=true)
  public static String getObjectName(String recordId) {
    try {
      String prefix = recordId.substring(0, 3);
      Map<String, Schema.SObjectType> globalDescribe = Schema.getGlobalDescribe();

      for (Schema.SObjectType objType : globalDescribe.values()) {
        if (objType.getDescribe().getKeyPrefix() == prefix) {
          return objType.getDescribe().getName();
        }
      }

      return 'Unknown Object';
    } catch (Exception e) {
      throw new AuraHandledException(
        'Error retrieving object name: ' + e.getMessage()
      );
    }
  }

  @AuraEnabled
  public static void deleteProjectOrContent(
    String projectId,
    String contentVersionId
  ) {
    try {
      if (String.isBlank(projectId) && String.isBlank(contentVersionId)) {
        throw new AuraHandledException(
          'No project or content version ID provided for deletion.'
        );
      }
      // Delete ContentVersion if contentVersionId is provided
      if (String.isNotBlank(contentVersionId)) {
        ContentVersion contentVersion = [
          SELECT ContentDocumentId
          FROM ContentVersion
          WHERE Id = :contentVersionId
          LIMIT 1
        ];
        if (contentVersion != null) {
          List<ContentDocument> contentDocs = [
            SELECT Id
            FROM ContentDocument
            WHERE Id = :contentVersion.ContentDocumentId
            LIMIT 1
          ];
          if (!contentDocs.isEmpty()) {
            delete contentDocs; // Handles deletion in a bulk-safe way
          } else {
            System.debug(
              'ContentDocument not found for ContentVersionId: ' +
              contentVersionId
            );
            throw new AuraHandledException(
              'ContentDocument not found for provided ContentVersionId.'
            );
          }
        } else {
          System.debug(
            'ContentVersion not found for provided Id: ' + contentVersionId
          );
          throw new AuraHandledException(
            'ContentVersion not found for provided Id.'
          );
        }
      }

      // Add project-specific deletion logic if projectId is provided
      if (String.isNotBlank(projectId)) {
        // Example: delete related records associated with the projectId if necessary
        // delete [SELECT Id FROM YourCustomObject__c WHERE ProjectId__c = :projectId];
      }
    } catch (Exception e) {
      System.debug('Error deleting project or content: ' + e.getMessage());
      throw new AuraHandledException(
        'Error deleting project or content: ' + e.getMessage()
      );
    }
  }

  @AuraEnabled(cacheable=true)
  public static List<String> getAvailableFields(String objectName) {
    List<String> fieldNames = new List<String>();
    try {
      // Describe the object and get all fields
      Map<String, Schema.SObjectField> fieldsMap = Schema.getGlobalDescribe()
        .get(objectName)
        .getDescribe()
        .fields.getMap();

      // Collect field names
      for (String fieldName : fieldsMap.keySet()) {
        fieldNames.add(fieldName);
      }
    } catch (Exception e) {
      System.debug('Error fetching fields: ' + e.getMessage());
    }
    return fieldNames;
  }

  @AuraEnabled
  public static Id updateProjectInfo(
    String contentVersionId,
    String downloadUrl,
    String projectName,
    String mimeType,
    String projectId,
    String encodedOptions,
    String templateId
  ) {
    try {
      // Fetch the new file content
      Http http = new Http();
      HttpRequest request = new HttpRequest();
      request.setEndpoint(downloadUrl);
      request.setMethod('GET');
      HttpResponse response = http.send(request);
      if (response.getStatusCode() != 200) {
        throw new AuraHandledException(
          'Failed to fetch file from URL: Status=' + response.getStatusCode()
        );
      }
      Blob fileBlob = response.getBodyAsBlob();

      // Retrieve the existing ContentVersion
      ContentVersion existingVersion = [
        SELECT
          Id,
          Title,
          PathOnClient,
          ContentDocumentId,
          ProjectId__c,
          EncodedOptions__c,
          FirstPublishLocationId,
          opportunity_stage_at_creation__c,
          marq_original_project_created_at__c,
          Public_Link__c
        FROM ContentVersion
        WHERE Id = :contentVersionId
        LIMIT 1
      ];

      if (existingVersion != null) {
        // Create a new version of the ContentVersion
        ContentVersion newVersion = new ContentVersion();
        newVersion.VersionData = fileBlob;
        newVersion.Title = projectName;
        String fileExtension = getFileExtension(mimeType);
        newVersion.PathOnClient = projectName + '.' + fileExtension;
        newVersion.ContentDocumentId = existingVersion.ContentDocumentId;
        newVersion.ProjectId__c = projectId;
        newVersion.EncodedOptions__c = encodedOptions;
        newVersion.marq_origin_templatekey__c =
          templateId +
          '-' +
          existingVersion.FirstPublishLocationId;
        newVersion.opportunity_stage_at_creation__c = existingVersion.opportunity_stage_at_creation__c; // Retain the original value
        newVersion.marq_original_project_created_at__c = existingVersion.marq_original_project_created_at__c; // Copy the existing value

        // Copy the Public Link from the previous version
        newVersion.Public_Link__c = existingVersion.Public_Link__c;

        insert newVersion;

        // Return the new ContentVersion Id
        return newVersion.Id;
      } else {
        throw new AuraHandledException(
          'ContentVersion not found with Id: ' + contentVersionId
        );
      }
    } catch (Exception e) {
      System.debug('Exception in updateProjectInfo: ' + e.getMessage());
      throw new AuraHandledException(
        'Error updating content version: ' + e.getMessage()
      );
    }
  }

  @AuraEnabled
  public static String saveProjectInfo(
    String recordId,
    String projectId,
    String thumbnailUrl,
    String projectName,
    String encodedOptions,
    String templateId,
    String stageName
  ) {
    Http http = new Http();
    HttpRequest request = new HttpRequest();
    request.setEndpoint(thumbnailUrl);
    request.setMethod('GET');

    try {
      HttpResponse response = http.send(request);
      if (response.getStatusCode() == 200) {
        Blob fileBlob = response.getBodyAsBlob();

        // Create a new ContentVersion for the thumbnail
        ContentVersion contentVersion = new ContentVersion();
        contentVersion.Title = projectName;
        contentVersion.PathOnClient = projectName + '.jpg'; // Assuming the thumbnail is a JPG
        contentVersion.VersionData = fileBlob;
        contentVersion.ContentLocation = 'S'; // Salesforce-managed content
        contentVersion.FirstPublishLocationId = recordId;
        contentVersion.ProjectId__c = projectId;
        contentVersion.EncodedOptions__c = encodedOptions;
        contentVersion.marq_origin_templatekey__c = templateId + '-' + recordId;
        contentVersion.Opportunity_stage_at_creation__c = stageName;
        contentVersion.marq_original_project_created_at__c = DateTime.now();

        // Insert the ContentVersion
        insert contentVersion;

        // Retrieve the associated ContentDocumentId
        ContentVersion insertedVersion = [
          SELECT ContentDocumentId
          FROM ContentVersion
          WHERE Id = :contentVersion.Id
          LIMIT 1
        ];

        // Update the ContentDocumentLink to set Visibility to 'AllUsers'
        List<ContentDocumentLink> documentLinks = [
          SELECT Id, Visibility
          FROM ContentDocumentLink
          WHERE
            ContentDocumentId = :insertedVersion.ContentDocumentId
            AND LinkedEntityId = :recordId
        ];
        for (ContentDocumentLink link : documentLinks) {
          link.Visibility = 'AllUsers'; // Allow all users to view
        }
        update documentLinks;

        // Prepare the response
        Map<String, Object> responseMap = new Map<String, Object>();
        responseMap.put('contentVersionId', contentVersion.Id);
        responseMap.put('contentDocumentId', insertedVersion.ContentDocumentId);

        return JSON.serialize(responseMap);
      } else {
        throw new AuraHandledException(
          'Failed to fetch thumbnail from external service: Status=' +
          response.getStatus()
        );
      }
    } catch (Exception e) {
      throw new AuraHandledException(
        'Server error occurred: ' + e.getMessage()
      );
    }
  }

  public class ContentVersionWrapper {
    @AuraEnabled
    public Id contentVersionId;
    @AuraEnabled
    public String projectId;
    @AuraEnabled
    public String contenttitle;
    @AuraEnabled
    public String publicLink;
    @AuraEnabled
    public String lastModifiedDate;
  }

  @AuraEnabled(cacheable=true)
  public static ContentVersionWrapper findRelatedContentVersionByTemplateKey(
    String templateKey
  ) {
    ContentVersionWrapper result = new ContentVersionWrapper();
    try {
      // Step 1: Fetch the initial ContentVersion using the templateKey
      List<ContentVersion> contentVersions = [
        SELECT Id, ContentDocumentId
        FROM ContentVersion
        WHERE marq_origin_templatekey__c = :templateKey
        ORDER BY CreatedDate DESC
        LIMIT 1
      ];
      if (!contentVersions.isEmpty()) {
        ContentVersion contentVersion = contentVersions[0];

        // Step 2: Fetch the latest ContentVersion using the ContentDocumentId
        ContentVersion latestContentVersion = [
          SELECT Id, Public_Link__c, ProjectId__c, LastModifiedDate
          FROM ContentVersion
          WHERE
            ContentDocumentId = :contentVersion.ContentDocumentId
            AND IsLatest = TRUE
          LIMIT 1
        ];

        // Step 3: Assign values from the latest ContentVersion to the result
        result.contentVersionId = latestContentVersion.Id;
        result.publicLink = latestContentVersion.Public_Link__c;
        result.projectId = latestContentVersion.ProjectId__c;
        result.lastModifiedDate = latestContentVersion.LastModifiedDate != null
          ? latestContentVersion.LastModifiedDate.formatGMT(
              'yyyy-MM-dd\'T\'HH:mm:ss.SSS\'Z\''
            )
          : null;

        // Step 4: Fetch the ContentDocument to get its title
        ContentDocument contentDocument = [
          SELECT Title
          FROM ContentDocument
          WHERE Id = :contentVersion.ContentDocumentId
          LIMIT 1
        ];
        result.contenttitle = contentDocument.Title;
      }
    } catch (Exception e) {
      System.debug(
        'Error fetching ContentVersion by templateKey: ' + e.getMessage()
      );
      throw new AuraHandledException(
        'Error fetching ContentVersion by templateKey: ' + e.getMessage()
      );
    }
    return result;
  }

  private static String handleFileDownload(
    String recordId,
    String downloadUrl,
    String projectName,
    String mimeType,
    String projectId,
    String encodedOptions,
    String templateId
  ) {
    Http http = new Http();
    HttpRequest request = new HttpRequest();
    request.setEndpoint(downloadUrl);
    request.setMethod('GET');

    try {
      HttpResponse response = http.send(request);
      if (response.getStatusCode() == 200) {
        Blob fileBlob = response.getBodyAsBlob();

        // Always create a new ContentDocument
        ContentVersion contentVersion = new ContentVersion();
        contentVersion.Title = projectName;
        String fileExtension = getFileExtension(mimeType);
        contentVersion.PathOnClient = projectName + '.' + fileExtension;
        contentVersion.VersionData = fileBlob;
        contentVersion.ContentLocation = 'S';
        contentVersion.FirstPublishLocationId = recordId;
        contentVersion.ProjectId__c = projectId;
        contentVersion.EncodedOptions__c = encodedOptions;

        // Add marq_origin_templatekey__c
        contentVersion.marq_origin_templatekey__c = templateId + '-' + recordId;

        insert contentVersion;

        // Retrieve the ContentDocumentId
        Id contentDocumentId = [
          SELECT ContentDocumentId
          FROM ContentVersion
          WHERE Id = :contentVersion.Id
        ]
        .ContentDocumentId;

        // Ensure a ContentDocumentLink is created
        createContentDocumentLink(contentDocumentId, recordId);

        return contentDocumentId;
      } else {
        System.debug(
          'HTTP callout failed with status: ' + response.getStatus()
        );
        throw new AuraHandledException(
          'Failed to fetch file from external service: Status=' +
          response.getStatus()
        );
      }
    } catch (Exception e) {
      System.debug('Exception occurred: ' + e.getMessage());
      throw new AuraHandledException(
        'Server error occurred: ' + e.getMessage()
      );
    }
  }

  private static void createContentDocumentLink(
    Id contentDocumentId,
    String recordId
  ) {
    List<ContentDocumentLink> existingLinks = [
      SELECT Id
      FROM ContentDocumentLink
      WHERE
        ContentDocumentId = :contentDocumentId
        AND LinkedEntityId = :recordId
    ];
    if (existingLinks.isEmpty()) {
      ContentDocumentLink cdl = new ContentDocumentLink();
      cdl.ContentDocumentId = contentDocumentId;
      cdl.LinkedEntityId = recordId;
      cdl.ShareType = 'V';
      cdl.Visibility = 'AllUsers';
      insert cdl;
    }
  }

  private static String getFileExtension(String mimeType) {
    Map<String, String> mimeToExtension = new Map<String, String>{
      'application/pdf' => 'pdf',
      'image/png' => 'png',
      'image/jpeg' => 'jpg',
      'image/gif' => 'gif',
      'video/mp4' => 'mp4'
    };
    return mimeToExtension.containsKey(mimeType)
      ? mimeToExtension.get(mimeType)
      : 'bin'; // Default to 'bin' for unknown MIME types
  }

  @AuraEnabled(cacheable=true)
  public static String findObjectAPIName(String recordId) {
    System.debug('findObjectAPIName called with recordId: ' + recordId);

    if (recordId == null || recordId.length() < 3) {
      System.debug('Invalid recordId: ' + recordId);
      return null; // Added check for recordId length to prevent errors
    }

    String keyPrefix = recordId.substring(0, 3);
    System.debug('Key prefix: ' + keyPrefix);

    Map<String, Schema.SObjectType> gd = Schema.getGlobalDescribe(); // Store global describe result in a local variable to avoid multiple calls
    System.debug('Global describe size: ' + gd.size());

    for (Schema.SObjectType objType : gd.values()) {
      Schema.DescribeSObjectResult dor = objType.getDescribe();
      String prefix = dor.getKeyPrefix();
      if (prefix != null) {
        System.debug(
          'Checking prefix: ' + prefix + ' for object: ' + dor.getName()
        );
        if (prefix.equals(keyPrefix)) {
          // Use equals to compare strings properly
          System.debug('Match found: ' + dor.getName());
          return dor.getName();
        }
      }
    }
    System.debug('No match found for key prefix: ' + keyPrefix);
    return null; // Return null if no match is found
  }

  @AuraEnabled(cacheable=true)
  public static String getOrgId() {
    try {
      return UserInfo.getOrganizationId(); // Fetch the Organization ID
    } catch (Exception e) {
      System.debug('Error fetching Organization ID: ' + e.getMessage());
      throw new AuraHandledException('Unable to retrieve the Organization ID.');
    }
  }

  @AuraEnabled(cacheable=true)
  public static Boolean hasAdminPermission() {
    try {
      Boolean hasPermission = FeatureManagement.checkPermission('Marq_Admin'); // Check the custom permission
      System.debug('Marq_Admin Permission Check: ' + hasPermission);
      return hasPermission;
    } catch (Exception e) {
      System.debug('Error checking Marq_Admin permission: ' + e.getMessage());
      throw new AuraHandledException('Unable to verify Marq_Admin permission.');
    }
  }

  @AuraEnabled
  public static Id findRelatedContentVersionId(String quoteDocumentId) {
    // Check if the QuoteDocument object exists in the org
    if (!Schema.getGlobalDescribe().containsKey('QuoteDocument')) {
      System.debug('QuoteDocument object is not available in this org.');
      throw new AuraHandledException(
        'QuoteDocument feature is not enabled in this org.'
      );
    }

    try {
      // Query the QuoteDocument to get related information, e.g., QuoteId
      List<SObject> qDocs = Database.query(
        'SELECT QuoteId FROM QuoteDocument WHERE Id = :quoteDocumentId LIMIT 1'
      );

      if (qDocs.isEmpty()) {
        throw new AuraHandledException(
          'QuoteDocument not found for the given ID.'
        );
      }

      SObject qDoc = qDocs[0];
      Id quoteId = (Id) qDoc.get('QuoteId');

      // Assuming the Quote links to a ContentDocument
      List<ContentDocumentLink> docLinks = [
        SELECT ContentDocumentId
        FROM ContentDocumentLink
        WHERE LinkedEntityId = :quoteId
      ];

      if (!docLinks.isEmpty()) {
        // Fetch the latest ContentVersion related to the ContentDocument
        List<ContentVersion> cVersions = [
          SELECT Id
          FROM ContentVersion
          WHERE ContentDocumentId = :docLinks[0].ContentDocumentId
          ORDER BY CreatedDate DESC
          LIMIT 1
        ];

        if (!cVersions.isEmpty()) {
          return cVersions[0].Id;
        }
      }
    } catch (Exception e) {
      System.debug('Error in findRelatedContentVersionId: ' + e.getMessage());
      throw new AuraHandledException(
        'Error retrieving related ContentVersion: ' + e.getMessage()
      );
    }

    return null;
  }

  @AuraEnabled
  public static void updateContentVersionFields(
    String contentVersionId,
    String projectId,
    String encodedOptions
  ) {
    try {
      ContentVersion contentVersion = [
        SELECT Id, ProjectId__c, EncodedOptions__c
        FROM ContentVersion
        WHERE Id = :contentVersionId
        LIMIT 1
      ];

      if (contentVersion != null) {
        contentVersion.ProjectId__c = projectId;
        contentVersion.EncodedOptions__c = encodedOptions;
        update contentVersion;
      }
    } catch (Exception e) {
      System.debug('Error updating ContentVersion fields: ' + e.getMessage());
      throw new AuraHandledException(
        'Error updating ContentVersion fields: ' + e.getMessage()
      );
    }
  }

  @AuraEnabled
  public static String fetchFieldValue(Id recordId, String fieldName) {
    try {
      // Split the field name to handle relationships
      String[] fieldParts = fieldName.split('\\.');
      String queryField;
      String query;

      if (fieldParts.size() > 1) {
        // If it is a relationship field
        queryField = fieldParts[0] + '.' + fieldParts[1]; // For example, "Primary_contact__r.Email"
        query =
          'SELECT ' +
          queryField +
          ' FROM ' +
          recordId.getSObjectType() +
          ' WHERE Id = :recordId';
      } else {
        // Simple field
        queryField = fieldName;
        query =
          'SELECT ' +
          queryField +
          ' FROM ' +
          recordId.getSObjectType() +
          ' WHERE Id = :recordId';
      }

      SObject record = Database.query(query);
      // Accessing related object field if applicable
      if (fieldParts.size() > 1) {
        SObject relatedRecord = (SObject) record.getSObject(fieldParts[0]);
        return (String) relatedRecord.get(fieldParts[1]);
      } else {
        return (String) record.get(queryField);
      }
    } catch (Exception e) {
      System.debug('Error fetching field value: ' + e.getMessage());
      throw new AuraHandledException(
        'Unable to fetch field value: ' + e.getMessage()
      );
    }
  }

  private static String handleQuotePDFUpload(
    String recordId,
    String downloadUrl,
    String projectName,
    String projectId,
    String encodedOptions
  ) {
    // Check if QuoteDocument object exists in the org
    if (!Schema.getGlobalDescribe().containsKey('QuoteDocument')) {
      System.debug('QuoteDocument object is not available in this org.');
      throw new AuraHandledException(
        'QuoteDocument feature is not enabled in this org.'
      );
    }

    Http http = new Http();
    HttpRequest request = new HttpRequest();
    request.setEndpoint(downloadUrl);
    request.setMethod('GET');

    try {
      HttpResponse response = http.send(request);
      if (response.getStatusCode() == 200) {
        Blob pdfData = response.getBodyAsBlob();
        if (pdfData != null) {
          // Save as QuoteDocument and return the ID of the newly created QuoteDocument
          return saveQuoteDocument(
            recordId,
            pdfData,
            projectName,
            projectId,
            encodedOptions
          );
        } else {
          throw new AuraHandledException(
            'PDF generation failed: No PDF data returned.'
          );
        }
      } else {
        System.debug(
          'HTTP callout failed with status: ' + response.getStatus()
        );
        throw new AuraHandledException(
          'Failed to fetch PDF from external service: Status=' +
          response.getStatus()
        );
      }
    } catch (Exception e) {
      System.debug('Exception occurred: ' + e.getMessage());
      throw new AuraHandledException(
        'Server error occurred: ' + e.getMessage()
      );
    }
  }

  private static String saveQuoteDocument(
    String recordId,
    Blob pdfData,
    String projectName,
    String projectId,
    String encodedOptions
  ) {
    // Check if the QuoteDocument object exists in the org
    if (!Schema.getGlobalDescribe().containsKey('QuoteDocument')) {
      System.debug('QuoteDocument object is not available in this org.');
      throw new AuraHandledException(
        'QuoteDocument feature is not enabled in this org.'
      );
    }

    try {
      // Create a dynamic SObject instance for QuoteDocument
      SObject quoteDoc = Schema.getGlobalDescribe()
        .get('QuoteDocument')
        .newSObject();
      quoteDoc.put('QuoteId', recordId);
      quoteDoc.put('Document', pdfData);

      // Insert the QuoteDocument dynamically
      insert quoteDoc;

      // Retrieve the ID of the newly created QuoteDocument
      return (Id) quoteDoc.get('Id');
    } catch (Exception e) {
      System.debug('Error in saveQuoteDocument: ' + e.getMessage());
      throw new AuraHandledException(
        'Error saving QuoteDocument: ' + e.getMessage()
      );
    }
  }

  @AuraEnabled
  public static String createPublicLink(
    String contentVersionId,
    String projectName
  ) {
    try {
      if (String.isBlank(contentVersionId)) {
        throw new AuraHandledException('ContentVersionId is required.');
      }
      if (String.isBlank(projectName)) {
        throw new AuraHandledException('Project name is required.');
      }

      // Retrieve the ContentDocumentId from the initial ContentVersion
      ContentVersion contentVersion = [
        SELECT Id, ContentDocumentId
        FROM ContentVersion
        WHERE Id = :contentVersionId
        LIMIT 1
      ];

      // Retrieve the latest ContentVersion (IsLatest = true)
      ContentVersion latestContentVersion = [
        SELECT Id
        FROM ContentVersion
        WHERE
          ContentDocumentId = :contentVersion.ContentDocumentId
          AND IsLatest = TRUE
        LIMIT 1
      ];

      // Use the latest ContentVersionId for creating the public link
      String latestContentVersionId = latestContentVersion.Id;

      // Create a ContentDistribution record (Public Link)
      ContentDistribution publicLink = new ContentDistribution();
      publicLink.ContentVersionId = latestContentVersionId;
      publicLink.Name = projectName; // Use the project name as the title
      publicLink.PreferencesNotifyOnVisit = false; // Disable tracking visits
      publicLink.PreferencesAllowOriginalDownload = true; // Allow file downloads

      insert publicLink;

      // Retrieve the DistributionPublicUrl
      publicLink = [
        SELECT DistributionPublicUrl
        FROM ContentDistribution
        WHERE Id = :publicLink.Id
      ];

      System.debug('Public Link Created: ' + publicLink.DistributionPublicUrl);

      // Save the public link to a custom field on the latest ContentVersion record
      ContentVersion contentVersionToUpdate = [
        SELECT Id, Public_Link__c
        FROM ContentVersion
        WHERE
          ContentDocumentId = :contentVersion.ContentDocumentId
          AND IsLatest = TRUE
        LIMIT 1
      ];
      contentVersionToUpdate.Public_Link__c = publicLink.DistributionPublicUrl;
      update contentVersionToUpdate;

      // Return the unrestricted public link URL
      return JSON.serialize(
        new Map<String, String>{
          'success' => 'true',
          'contentPublicUrl' => publicLink.DistributionPublicUrl
        }
      );
    } catch (Exception e) {
      System.debug('Error creating public link: ' + e.getMessage());
      throw new AuraHandledException(
        'Error creating public link: ' + e.getMessage()
      );
    }
  }

  @AuraEnabled(cacheable=true)
  public static Id findContentDocumentId(Id contentVersionId) {
    try {
      ContentVersion contentVersion = [
        SELECT ContentDocumentId
        FROM ContentVersion
        WHERE Id = :contentVersionId
        LIMIT 1
      ];
      System.debug('Content Document ID: ' + contentVersion.ContentDocumentId);
      return contentVersion.ContentDocumentId;
    } catch (Exception e) {
      System.debug('Error fetching ContentDocument ID: ' + e.getMessage());
      throw new AuraHandledException(
        'Error fetching ContentDocument ID: ' + e.getMessage()
      );
    }
  }

  public class CustomException extends Exception {
  }
}
