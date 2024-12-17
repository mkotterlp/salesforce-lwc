public with sharing class MarqFileEditorController {
  @AuraEnabled
  public static String fetchProjectIdFromContentVersion(Id contentDocumentId) {
    try {
      // Query the latest ContentVersion for the provided ContentDocumentId
      List<ContentVersion> versions = [
        SELECT ProjectId__c, EncodedOptions__c
        FROM ContentVersion
        WHERE ContentDocumentId = :contentDocumentId
        ORDER BY CreatedDate DESC
        LIMIT 1
      ];

      // Check if any versions were returned
      if (versions.isEmpty()) {
        System.debug(
          'No ContentVersion found for ContentDocumentId: ' + contentDocumentId
        );
        return null; // Handle case where no versions are found
      }

      ContentVersion version = versions[0];
      Map<String, String> result = new Map<String, String>{
        'versionId' => version.Id,
        'projectId' => version.ProjectId__c,
        'encodedOptions' => version.EncodedOptions__c
      };

      return JSON.serialize(result);
    } catch (Exception e) {
      System.debug(
        'Exception in fetchProjectIdFromContentVersion: ' + e.getMessage()
      );
      throw new AuraHandledException(
        'Error fetching Project ID and Encoded Options: ' + e.getMessage()
      );
    }
  }

  @AuraEnabled
  public static String updateFileVersion(
    String versionId,
    String fileUrl,
    String newFileName,
    String mimeType
  ) {
    try {
      HttpRequest req = new HttpRequest();
      req.setEndpoint(fileUrl);
      req.setMethod('GET');
      HttpResponse res = new Http().send(req);
      if (res != null) {
        Blob fileBlob = res.getBodyAsBlob();

        ContentVersion existingVersion = [
          SELECT
            Title,
            PathOnClient,
            Description,
            ContentDocumentId,
            ProjectId__c,
            EncodedOptions__c
          FROM ContentVersion
          WHERE Id = :versionId
          LIMIT 1
        ];

        if (existingVersion != null) {
          ContentVersion newVersion = existingVersion.clone(false, true);
          newVersion.VersionData = fileBlob;
          newVersion.Title = newFileName;
          newVersion.PathOnClient =
            newFileName +
            '.' +
            getFileExtension(mimeType);
          insert newVersion;

          // Return the new version ID as a string
          return newVersion.Id;
        }
      }
    } catch (Exception e) {
      System.debug('Exception in updateFileVersion: ' + e.getMessage());
      throw new AuraHandledException(
        'Error updating file version: ' + e.getMessage()
      );
    }
    return null; // Return null if no new version was created
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

  @AuraEnabled
  public static Blob getContentFromURL(String downloadUrl) {
    HttpRequest request = new HttpRequest();
    request.setEndpoint(downloadUrl);
    request.setMethod('GET');

    Http http = new Http();
    try {
      HttpResponse response = http.send(request);
      if (response.getStatusCode() == 200) {
        return response.getBodyAsBlob();
      } else {
        // Instead of throwing a generic Exception, use AuraHandledException for better integration with Lightning Components
        System.debug(
          'HTTP Request failed with status: ' + response.getStatusCode()
        );
        System.debug('HTTP Response body: ' + response.getBody());
        throw new AuraHandledException(
          'HTTP Request failed with status: ' +
            response.getStatusCode() +
            ' and body: ' +
            response.getBody()
        );
      }
    } catch (Exception e) {
      System.debug('Exception in getContentFromURL: ' + e.getMessage());
      throw new AuraHandledException(
        'Failed to retrieve content from URL: ' + e.getMessage()
      );
    }
  }

  @AuraEnabled
  public static Map<String, Object> fetchLatestVersionDetails(
    Id contentDocumentId
  ) {
    try {
      ContentVersion latestVersion = [
        SELECT
          Id,
          Title,
          Description,
          ContentSize,
          CreatedDate,
          CreatedBy.Name,
          VersionNumber,
          ContentDocumentId
        FROM ContentVersion
        WHERE ContentDocumentId = :contentDocumentId
        ORDER BY CreatedDate DESC
        LIMIT 1
      ];
      return new Map<String, Object>{
        'Id' => latestVersion.Id,
        'Title' => latestVersion.Title,
        'Description' => latestVersion.Description,
        'ContentSize' => latestVersion.ContentSize,
        'CreatedDate' => latestVersion.CreatedDate,
        'CreatedBy' => latestVersion.CreatedBy.Name,
        'VersionNumber' => latestVersion.VersionNumber,
        'ContentDocumentId' => latestVersion.ContentDocumentId
      };
    } catch (Exception e) {
      System.debug('Exception in fetchLatestVersionDetails: ' + e.getMessage());
      throw new AuraHandledException(
        'Error fetching latest version details: ' + e.getMessage()
      );
    }
  }
}
