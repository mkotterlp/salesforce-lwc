import { LightningElement, api, track, wire } from "lwc";
import { getRecord, getFieldValue, getRecordUi } from "lightning/uiRecordApi";
import { refreshApex } from "@salesforce/apex";
import uploadFileToRecord from "@salesforce/apex/MarqFileUploaderController.uploadFileToRecord";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import LOGO_URL_FIELD from "@salesforce/schema/Account.Logo_URL__c";

export default class FileUploader extends LightningElement {
  @api recordId;
  @track fileData;
  @track isUploadDisabled = true;
  @track accountId;

  account;
  recordUi;

  @wire(getRecordUi, {
    recordIds: "$recordId",
    layoutTypes: ["Full"],
    modes: ["View"]
  })
  wiredRecordUi({ data, error }) {
    if (data) {
      this.recordUi = data;
      const record = data.records[this.recordId];
      const accountIdField = Object.keys(record.fields).find((field) =>
        field.endsWith(".AccountId")
      );

      if (accountIdField) {
        this.accountId = record.fields[accountIdField].value;
      } else {
        this.accountId = this.recordId; // If no AccountId field, assume the record itself is an Account
      }
    } else if (error) {
      this.dispatchEvent(
        new ShowToastEvent({
          title: "Error loading record",
          message: error.body.message,
          variant: "error"
        })
      );
    }
  }

  @wire(getRecord, { recordId: "$accountId", fields: [LOGO_URL_FIELD] })
  wiredAccount(result) {
    this.account = result;
    if (result.error) {
      this.dispatchEvent(
        new ShowToastEvent({
          title: "Error loading account",
          message: result.error.body.message,
          variant: "error"
        })
      );
    }
  }

  get logoUrl() {
    return this.account && this.account.data
      ? getFieldValue(this.account.data, LOGO_URL_FIELD)
      : "";
  }

  handleFileChange(event) {
    const file = event.target.files[0];
    const reader = new FileReader();

    reader.onload = () => {
      const base64 = reader.result.split(",")[1];
      this.fileData = {
        fileName: file.name,
        base64: base64,
        fileType: file.type,
        previewUrl: reader.result
      };
      this.isUploadDisabled = false;
    };
    reader.readAsDataURL(file);
  }

  handleUpload() {
    if (this.fileData) {
      uploadFileToRecord({
        recordId: this.accountId,
        fileName: this.fileData.fileName,
        base64Data: this.fileData.base64,
        fileType: this.fileData.fileType
      })
        .then((result) => {
          this.dispatchEvent(
            new ShowToastEvent({
              title: "Success",
              message: "File uploaded and account updated successfully.",
              variant: "success"
            })
          );
          this.fileData = null;
          this.isUploadDisabled = true;
          return refreshApex(this.account);
        })
        .catch((error) => {
          this.dispatchEvent(
            new ShowToastEvent({
              title: "Error uploading file",
              message: error.body ? error.body.message : error.message,
              variant: "error"
            })
          );
        });
    } else {
      this.dispatchEvent(
        new ShowToastEvent({
          title: "Error",
          message: "Please select a file to upload.",
          variant: "error"
        })
      );
    }
  }
}
