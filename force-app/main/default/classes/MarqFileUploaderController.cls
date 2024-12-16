public with sharing class MarqFileUploaderController {
    @AuraEnabled
    public static String uploadFileToRecord(Id recordId, String fileName, String base64Data, String fileType) {
        // Decode the base64 string
        Blob fileData = EncodingUtil.base64Decode(base64Data);

        // Create ContentVersion object
        ContentVersion contentVersion = new ContentVersion();
        contentVersion.VersionData = fileData;
        contentVersion.Title = fileName;
        contentVersion.PathOnClient = fileName;
        contentVersion.Origin = 'H';
        contentVersion.FirstPublishLocationId = recordId; // Associate with any record

        insert contentVersion;

        // Retrieve the ContentVersion Id
        contentVersion = [SELECT Id, ContentDocumentId FROM ContentVersion WHERE Id = :contentVersion.Id];

        // Create the public link
        ContentDistribution publicLink = new ContentDistribution(ContentVersionId = contentVersion.Id, 
            Name = 'External Link',
            PreferencesNotifyOnVisit = false);

        insert publicLink;

        publicLink = [SELECT ContentDownloadUrl, ContentDocumentId
                      FROM ContentDistribution 
                      WHERE Id = :publicLink.Id];

        // Update the record with the logo URL
        SObject recordToUpdate = Database.query('SELECT Id, Logo_URL__c FROM ' + recordId.getSObjectType() + ' WHERE Id = :recordId LIMIT 1');
        recordToUpdate.put('Logo_URL__c', publicLink.ContentDownloadUrl);

        update recordToUpdate;

        return publicLink.ContentDownloadUrl;
    }
}
