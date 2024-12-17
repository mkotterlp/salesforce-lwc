import { LightningElement, api, track, wire } from "lwc";
import fetchTemplatesfromMarq from "@salesforce/apex/MarqTemplateFetcher.fetchTemplates";
import fetchAndStoreTemplates from "@salesforce/apex/MarqTemplateFetcher.fetchAndStoreTemplates";
import img_copyPasteEmail from "@salesforce/resourceUrl/copyPasteEmail";
import img_faqCopyPublicLink from "@salesforce/resourceUrl/faqCopyPublicLink";
import img_faqDeleteProject from "@salesforce/resourceUrl/faqDeleteProject";
import img_faqEditProjects from "@salesforce/resourceUrl/faqEditProjects";
import img_faqViewEngagement from "@salesforce/resourceUrl/faqViewEngagement";
import img_emptyState from "@salesforce/resourceUrl/emptyState";
import img_fallback from "@salesforce/resourceUrl/fallback";
import {
  getRecord,
  getFieldValue,
  getRecordNotifyChange
} from "lightning/uiRecordApi";
import CURRENT_USER_ID from "@salesforce/user/Id";
import USER_EMAIL from "@salesforce/schema/User.Email";
import getAuthorizationUrl from "@salesforce/apex/MarqOAuthHandler.getAuthorizationUrl";
import getAccount from "@salesforce/apex/MarqDataSender.getAccount";
import getProducts from "@salesforce/apex/MarqDataSender.getProductsByOpportunityId";
import getSFDCAuthorizationUrl from "@salesforce/apex/MarqOAuthHandler.getSFDCAuthorizationUrl";
import sendDataToEndpoint from "@salesforce/apex/MarqDataSender.sendDataToEndpoint";
import createDataset from "@salesforce/apex/MarqDataSender.createDataset";
import saveAsFileAndUpdateRecord from "@salesforce/apex/MarqembedController.saveAsFileAndUpdateRecord";
import getAvailableFields from "@salesforce/apex/MarqembedController.getAvailableFields";
import saveProjectInfo from "@salesforce/apex/MarqembedController.saveProjectInfo";
import updateProjectInfo from "@salesforce/apex/MarqembedController.updateProjectInfo";
import getObjectName from "@salesforce/apex/MarqembedController.getObjectName";
import getMarqUserRecord from "@salesforce/apex/MarqOAuthHandler.getMarqUserRecord";
import deleteMarqUserRecord from "@salesforce/apex/MarqOAuthHandler.deleteMarqUserRecord";
import getMarqAccountRecord from "@salesforce/apex/MarqOAuthHandler.getMarqAccountRecord";
import getMarqDataRecord from "@salesforce/apex/MarqOAuthHandler.getMarqDataRecord";
import getSalesforceOauthRecord from "@salesforce/apex/MarqOAuthHandler.getSalesforceOauthRecord";
import findRelatedContentVersionByTemplateKey from "@salesforce/apex/MarqembedController.findRelatedContentVersionByTemplateKey";
import findContentDocumentId from "@salesforce/apex/MarqembedController.findContentDocumentId";
import deleteProjectOrContent from "@salesforce/apex/MarqembedController.deleteProjectOrContent";
import createContentDelivery from "@salesforce/apex/MarqembedController.createPublicLink";
import createProject from "@salesforce/apex/MarqCreateApi.createProject";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import { NavigationMixin } from "lightning/navigation";
import { refreshApex } from "@salesforce/apex";
import {
  registerRefreshHandler,
  unregisterRefreshHandler,
  RefreshEvent
} from "lightning/refresh";
import getRelatedRecords from "@salesforce/apex/MarqDataSender.getRelatedRecords";
import ACCOUNT_INDUSTRY_FIELD from "@salesforce/schema/Account.Industry";
import ACCOUNT_LOGO_FIELD from "@salesforce/schema/Account.Logo_URL__c";
import ACCOUNT_NAME_FIELD from "@salesforce/schema/Account.Name";
import getOrgId from "@salesforce/apex/MarqembedController.getOrgId";
import hasAdminPermission from "@salesforce/apex/MarqembedController.hasAdminPermission";

export default class Marqcard extends NavigationMixin(LightningElement) {
  @track isInitializing = true;
  @track forceSync = false;
  @track isSyncing = false;
  @track deletedFilters = [];
  @api recordId;
  @api buttonLabel = "Create New";
  @track linkLabel = "Create Public Link";
  @track loadingText = "Syncing Marq with Salesforce";
  @track isPublicLinkModalOpen = false;
  @track currentPublicLink = "";
  @track currentTemplateName = "";
  @track temporaryPublicLinks = {};
  @track displayedProjects = []; // Related content (projects)
  @track displayedTemplates = []; // Non-related content (templates)
  @track deletedTemplates = [];
  @track templates = [];
  @track userExists = false;
  @track accountExists = false;
  @track products = [];
  @track dataExists = false;
  @track sfdcOauthExists = false;
  @track allTemplates = [];
  @track recentChanges = {};
  @track isModalOpen = false;
  @track isSettingsModalOpen = false;
  @track isLoading = false;
  @track isFiltering = true;
  @track isSingleRow = false;
  @track templateisLoading = true;
  @track isCheckingContent = false;
  @track recentlyReinitializedOAuth = false;
  @track objectAPIName;
  @track activeTab = "templates";
  @track industry;
  @track stageName;
  @track transcript;
  @track iframeSrc;
  @track templatesFeed;
  @track lastTemplatSyncDate;
  @track selectedTemplateName;
  @track selectedTemplateId;
  @track contentTitle = "Relevant Content";
  @track publishedLinks = {};
  @track marqData;
  @track isMarqDataPresent = true;
  @track metadataType = "Template";
  @track searchTerm = "";
  @track linkUrl = "https://info.marq.com/salesforce-crm-settings";
  @track filteredTemplates = null;
  @api enableLock;
  @api enableDownload;
  @api enablePrint;
  @api enableCollaborate;
  @api enableShare;
  @api enableSaveName;
  @api enableBackButton;
  @api adminsettings;
  @api allowPDF;
  @api allowJPG;
  @api allowPNG;
  @api allowGIF;
  @api allowMP4;
  @api showDashboard;
  @api showDocuments;
  @api showTemplates;
  @api filterLogic;
  @api customFields;
  @api customSAMLlogin;
  @track objectName;
  userEmail;
  userId;
  @track loadCount = 6;
  @track currentOffset = 0;
  isInAppBuilder = false;
  @api textboxFields;
  @api textboxFilters;
  @api formattedtextboxFilters;
  @track wiredRecordResult;
  refreshHandlerID;
  @track marqUserId;
  @track isAuthCodeModalOpen = false;
  @track authorizationCode;
  @track isOAuthInitialized = false;
  @track templatesUrl = null;
  @track originalTemplates = [];
  @track lastSyncTime = null;
  @track marqdatasetid;
  @track marqcollectionid;
  @track autodatasetid;
  @track autocollectionid;
  availableFields = [];
  availableCustomFields = [];
  @track relatedRecords = {};
  @track accountlogo;
  @track accountindustry;
  @track accountId;
  img_copyPasteEmail = img_copyPasteEmail;
  img_faqCopyPublicLink = img_faqCopyPublicLink;
  img_faqDeleteProject = img_faqDeleteProject;
  img_faqEditProjects = img_faqEditProjects;
  img_faqViewEngagement = img_faqViewEngagement;
  img_emptyState = img_emptyState;
  img_fallback = img_fallback;

  async initializeTemplates() {
    try {
      this.templateisLoading = true;
      this.templates = [];
      this.displayedTemplates = [];
      this.allTemplates = [];
      this.currentOffset = 0;

      //   console.log("Initializing templates...");

      // Fetch templates
      try {
        await this.fetchTemplates(); // Fetch templates from server
      } catch (fetchError) {
        console.error(
          "Error fetching templates:",
          JSON.stringify(fetchError, Object.getOwnPropertyNames(fetchError))
        );
        throw new Error("Template fetch failed.");
      }

      // Load all templates
      try {
        await this.loadAllTemplates(); // Load all templates and process related content
      } catch (loadError) {
        console.error(
          "Error loading all templates:",
          JSON.stringify(loadError, Object.getOwnPropertyNames(loadError))
        );
        throw new Error("Template loading failed.");
      }

      //   console.log("Templates initialized and loaded.");
    } catch (error) {
      console.error(
        "Error during template initialization:",
        JSON.stringify(error, Object.getOwnPropertyNames(error))
      );
      this.templateisLoading = false;
    }
  }

  async initFilters() {
    try {
      // Initialize displayedTemplates based on filtered templates
      this.displayedTemplates = this.templates.slice(0, this.loadCount || 10);
      this.currentOffset = this.loadCount || 10;
      this.isFiltering = false;
    } catch (error) {
      console.error("Error in initFilters:", error);
      this.isFiltering = false;
    }
  }

  @wire(getRecord, {
    recordId: CURRENT_USER_ID,
    fields: [USER_EMAIL]
  })
  wiredUser({ error, data }) {
    if (data) {
      this.userEmail = getFieldValue(data, USER_EMAIL);
    } else if (error) {
      console.error("Error fetching user data:", error);
    }
  }

  get wiredAccountId() {
    return this.accountId ? this.accountId : null;
  }

  async fetchAccountData() {
    if (!this.accountId) {
      console.warn("No AccountId found to fetch account data.");
      return;
    }

    try {
      const account = await getAccount({ accountId: this.accountId });
      this.accountname = account.Name;
      this.accountindustry = account.Industry;
      this.accountlogo = account.Logo_URL__c;
    } catch (error) {
      console.error("Error fetching account data:", error);
    }
  }

  // @wire(getProducts, { opportunityId: '$recordId' })
  // wiredProducts({ error, data }) {
  //   if (data) {
  //     this.products = data.map(product => ({
  //       id: product.Id,
  //       name: product.PricebookEntry.Product2.Name,
  //       quantity: product.Quantity,
  //       price: product.UnitPrice,
  //       currencyIsoCode: product.CurrencyIsoCode || 'USD' // Default to 'USD' if not present
  //     }));
  //     this.error = undefined;
  //     this.triggerSendData();
  //   } else if (error) {
  //     this.error = error;
  //     this.products = [];
  //   }
  // }

  async fetchOpportunityProducts() {
    try {
      const products = await getProducts({ opportunityId: this.recordId });
      this.products = products.map((product) => ({
        id: product.Id,
        name: product.PricebookEntry.Product2.Name,
        quantity: product.Quantity,
        price: product.UnitPrice,
        date: product.ServiceDate,
        currencyIsoCode: product.CurrencyIsoCode || "USD" // Default to 'USD' if not present
      }));
    } catch (error) {
      console.error("Error fetching products:", error);
      this.error = error;
    }
  }

  @wire(getRecord, {
    recordId: "$recordId",
    fields: ["Opportunity.AccountId"]
  })
  wiredOpportunity({ error, data }) {
    if (data) {
      // Retrieve the AccountId from the Opportunity
      this.accountId = getFieldValue(data, "Opportunity.AccountId");
    } else if (error) {
      console.warn("Error fetching opportunity data:", error);
    }
  }

  // Separate @wire for Lead records
  @wire(getRecord, { recordId: "$recordId", fields: ["Lead.Company"] })
  wiredLead({ error, data }) {
    if (data) {
      this.recordName = getFieldValue(data, "Lead.Company") || "";
      this.refreshView();
    } else if (error) {
      console.warn("Error fetching Lead data:", error);
    }
  }

  handleShowFilters() {
    const fields = this.textboxFields
      ? this.textboxFields.split(",").map((f) => f.trim())
      : [];
    const filters = this.textboxFilters
      ? this.textboxFilters.split(",").map((f) => f.trim())
      : [];
    const filterLogic = this.filterLogic || "No specific logic applied";

    let filterMessage = "Currently Applied Filters:\n";

    if (fields.length && filters.length && fields.length === filters.length) {
      fields.forEach((field, index) => {
        filterMessage += `- ${field}: ${filters[index]}\n`;
      });
      filterMessage += `Logic: ${filterLogic}`;
    } else {
      filterMessage += "No filters are currently applied.";
    }

    this.showToast("Applied Filters", filterMessage, "info");
  }

  async handleAsyncOperations() {
    try {
      // Check if userExists has not already been determined
      if (this.userExists === false || this.userExists === undefined) {
        this.userExists = await this.checkUserExists();
      }

      if (this.userExists) {
        this.isOAuthInitialized = true;
        await this.initializeTemplates();
      }
    } catch (error) {
      console.error("Error during user existence check:", error);
    }

    try {
      // Check if accountExists has not already been determined
      if (this.accountExists === false || this.accountExists === undefined) {
        this.accountExists = await this.checkAccountExists();
      }

      if (this.accountExists) {
        await this.fetchAccountData();

        try {
          // Check if Data exists
          if (this.dataExists === false || this.dataExists === undefined) {
            this.dataExists = await this.checkDataExists();
          }
          if (this.dataExists) {
            this.dataExists = true;
            this.isMarqDataPresent = true;
            this.triggerSendData();
          } else {
            if (!this.isMarqDataPresent) {
              console.warn(
                "Marq data is not ready. The method execution will be skipped."
              );
              return;
            }

            try {
              // Prepare the schema dynamically based on customFields
              const schema = [
                { name: "Id", fieldType: "STRING", isPrimary: true, order: 1 },
                {
                  name: "Name",
                  fieldType: "STRING",
                  isPrimary: false,
                  order: 2
                },
                {
                  name: "Logo",
                  fieldType: "STRING",
                  isPrimary: false,
                  order: 3
                },
                {
                  name: "Industry",
                  fieldType: "STRING",
                  isPrimary: false,
                  order: 4
                },
                {
                  name: "Marq User Restriction",
                  fieldType: "STRING",
                  isPrimary: false,
                  order: 5
                }
              ];

              if (this.customFields) {
                const fieldsArray = this.customFields
                  .split(",")
                  .map((field) => field.trim());
                fieldsArray.forEach((field) => {
                  const fieldName = field.split(".").pop(); // Get the actual field name without the relationship prefix
                  let fieldType = "STRING"; // Default field type

                  // Check if field name contains logo, img, or image (case-insensitive)
                  const lowerCaseFieldName = fieldName.toLowerCase();
                  if (
                    lowerCaseFieldName.includes("logo") ||
                    lowerCaseFieldName.includes("img") ||
                    lowerCaseFieldName.includes("image")
                  ) {
                    fieldType = "STRING"; //set as "IMAGE" when we get that working
                  }

                  schema.push({
                    name: fieldName,
                    fieldType: fieldType,
                    isPrimary: false,
                    order: schema.length + 1
                  });
                });
              }

              //  console.log('Sending payload for create Dataset:', JSON.stringify(payload));

              const datasetCreationResponse = await createDataset({
                objectName: this.objectName,
                schema: schema
              });

              const createdataset = JSON.parse(datasetCreationResponse);

              // Assuming datasetCreationResult contains collectionId and dataSourceId
              if (
                createdataset &&
                createdataset.collectionId &&
                createdataset.dataSourceId
              ) {
                this.marqcollectionid = createdataset.collectionId;
                this.marqdatasetid = createdataset.dataSourceId;
              } else {
                console.warn(
                  "Dataset creation result is missing collectionId or dataSourceId."
                );
                return;
              }
            } catch (error) {
              console.error("Error creating dataset:", error);
              this.showToast(
                "Error",
                "Failed to create dataset. Check console for details.",
                "error"
              );
              // this.resetDataInitialization();
              return;
            }
          }
        } catch (error) {
          console.error("Error during data existence check:", error);
        }
      }
    } catch (error) {
      console.error("Error during account existence check:", error);
    }

    try {
      // Check if sfdcOauthExists has not already been determined
      if (
        this.sfdcOauthExists === false ||
        this.sfdcOauthExists === undefined
      ) {
        this.sfdcOauthExists = await this.checkSFDCOauthExists();
      }

      if (this.sfdcOauthExists) {
        //TODO: Add action here
      }
    } catch (error) {
      console.error("Error during SFDC OAuth existence check:", error);
    } finally {
      // Set initializing to false when all checks are complete
      this.isInitializing = false;
    }
  }

  @wire(getRecord, {
    recordId: "$wiredAccountId",
    fields: [ACCOUNT_NAME_FIELD, ACCOUNT_INDUSTRY_FIELD, ACCOUNT_LOGO_FIELD]
  })
  wiredAccount({ error, data }) {
    if (data) {
      this.accountname = getFieldValue(data, ACCOUNT_NAME_FIELD);
      this.accountindustry = getFieldValue(data, ACCOUNT_INDUSTRY_FIELD);
      this.accountlogo = getFieldValue(data, ACCOUNT_LOGO_FIELD);
    } else if (error) {
      console.warn("Error fetching account data:", error);
    }
  }

  async checkAccountExists() {
    try {
      const result = await getMarqAccountRecord();
      if (result && result.accounttableresult) {
        // Assign the marquserid and templatesfeed to tracked properties
        this.marqAccountId = result.accounttableresult.marqaccountid;

        return this.marqAccountId != null; // Check if marquserid exists
      }
      return false;
    } catch (error) {
      console.error("Error checking account existence:", error);
      return false; // Default to "not exist" on error
    }
  }

  async checkSFDCOauthExists() {
    try {
      const result = await getSalesforceOauthRecord();
      if (result && result.sfdcaccounttableresult) {
        // Assign the marquserid and templatesfeed to tracked properties
        this.sfdcId = result.sfdcaccounttableresult.salesforceaccountid;

        return this.sfdcId != null; // Check if marquserid exists
      }
      return false;
    } catch (error) {
      console.error("Error checking account existence:", error);
      return false; // Default to "not exist" on error
    }
  }

  async deleteMarqUserRecord() {
    try {
      const result = await deleteMarqUserRecord();
      if (result && result.usertableresult) {
        return this.marqUserId != null; // Check if marquserid exists
      }
      return false;
    } catch (error) {
      console.error("Error checking user existence:", error);
      return false; // Default to "not exist" on error
    }
  }

  async checkUserExists() {
    try {
      const result = await getMarqUserRecord();
      if (result && result.usertableresult) {
        // Assign the marquserid and templatesfeed to tracked properties
        this.marqUserId = result.usertableresult.marquserid;
        this.templatesFeed = result.usertableresult.templatesfeed; // Assign templatesfeed
        this.lastTemplatSyncDate = result.usertableresult.lasttemplatesyncdate;

        return this.marqUserId != null; // Check if marquserid exists
      }
      return false;
    } catch (error) {
      console.error("Error checking user existence:", error);
      return false; // Default to "not exist" on error
    }
  }

  async checkDataExists() {
    try {
      const result = await getMarqDataRecord({
        objectName: this.objectName
      });

      if (result && result.datatableresult) {
        this.marqdataresult = result.datatableresult;
        this.marqcollectionid = result.datatableresult.marqcollectionid;
        this.marqdatasetid = result.datatableresult.marqdatasetid;
        return this.marqdataresult != null;
      }
      return false;
    } catch (error) {
      console.error("Error checking user existence:", error);
      return false; // Default to "not exist" on error
    }
  }

  async triggerSendData() {
    if (!this.objectName) {
      return;
    }
    try {
      await this.sendData();
    } catch (error) {
      console.error("Error sending data:", error);
    }
  }

  get templatesprocessed() {
    return !this.templateisLoading && !this.isCheckingContent;
  }

  get noResultsFound() {
    return !this.hasProjects && !this.hasTemplates;
  }

  get showFilteredTemplates() {
    return !this.isFiltering && this.displayedTemplates.length > 0;
  }

  get hasNoSearchResults() {
    return (
      this.searchTerm &&
      (!this.filteredTemplates || this.filteredTemplates.length === 0)
    );
  }

  get showContent() {
    return this.isOAuthInitialized;
  }

  // Method to filter fields correctly
  get dynamicFields() {
    if (!this.availableFields.length) return [];
    const fieldsSet = new Set(
      this.textboxFields
        ? this.textboxFields.split(",").map((field) => field.trim())
        : []
    );

    // Extract the field name without the object prefix
    const existentFields = [...fieldsSet].filter((field) => {
      const fieldNameWithoutPrefix = field.split(".").pop();
      return this.availableFields.includes(
        fieldNameWithoutPrefix.toLowerCase()
      );
    });

    // console.log('Dynamic fields for textbox:', JSON.stringify(existentFields));
    return existentFields;
  }

  get dynamicFieldsForCustomFields() {
    if (!this.customFields || !this.availableFields.length) return [];

    const fieldsArray = this.customFields
      .split(",")
      .map((field) => field.trim());

    const validFields = fieldsArray.filter((field) => {
      const [objectName, fieldName] = field.split("."); // Split the object and field name
      const lowerCaseObjectName = objectName.toLowerCase(); // Convert object name to lower case
      const lowerCaseFieldName = fieldName.toLowerCase(); // Convert field name to lower case

      // Construct the field string to match against availableFields
      const fieldToMatch = `${lowerCaseFieldName}`; // Since availableFields do not have object names

      const isValid = this.availableFields.includes(fieldToMatch);

      return isValid;
    });

    // console.log('Valid custom fields:', JSON.stringify(validFields));
    return validFields;
  }

  getFormattedDate(dateString) {
    if (!dateString) return "Unknown Date";
    const date = new Date(dateString);
    return date.toLocaleDateString(); // Formats to MM/DD/YYYY or adjust as needed
  }

  @wire(getRecord, { recordId: "$recordId", fields: "$dynamicFields" })
  wiredRecord(result) {
    if (!this.recordId) return;
    if (!this.isInitializing) {
      this.wiredRecordResult = result;
      if (result.data) {
        this.recordData = result.data;
        this.recordName =
          getFieldValue(result.data, `${this.objectName}.Name`) || ""; // Use the dynamically qualified name
        if (this.objectName === "Opportunity") {
          this.stageName = getFieldValue(result.data, "Opportunity.StageName");
          // console.log('StageName:', this.stageName); // Log the StageName for debugging
        }
        this.handleAsyncOperations();
        this.refreshView(); // Refresh the view when the filter value changes
      } else if (result.error) {
        console.warn("Failed to fetch the record data: ", result.error);
      }
    }
  }

  @wire(getRecord, {
    recordId: "$recordId",
    fields: "$dynamicFieldsForCustomFields"
  })
  async wiredCustomFieldsRecord(result) {
    if (!this.recordId || !this.customFields || !this.availableFields) return;
    this.wiredRecordResultForCustomFields = result;
    if (result.data) {
      // console.log('Custom fields data:', JSON.stringify(result.data));
      this.recordDataForCustomFields = result.data;
      await this.processCustomFields();
      this.triggerSendData();
    } else if (result.error) {
      console.warn(
        "Failed to fetch the custom fields record data: ",
        result.error
      );
    }
  }

  initializeMarqData() {
    this.metadataType = "Data";
    this.initializeOAuth("Data");
  }

  handleAccountAuthorizeClick() {
    this.metadataType = "data";
    this.initializeOAuth("data");
  }

  handleAuthorizeClick() {
    this.metadataType = "user";
    this.initializeOAuth();
  }

  handleSFDCAuthorizeClick() {
    this.initializeSFDCOAuth();
  }

  async initializeOAuth(metadataType = "user") {
    try {
      const authorizationUrl = await getAuthorizationUrl({
        metadataType: metadataType
      });
      if (authorizationUrl) {
        let oauthWindow;
        oauthWindow = window.open(
          authorizationUrl,
          "oauthWindow",
          "width=600,height=600"
        );

        // Listen for window close event to ensure the window is closed
        const checkWindowClosed = setInterval(() => {
          if (oauthWindow.closed) {
            // console.log('OAuth window closed.');
            clearInterval(checkWindowClosed);
            this.handleWindowClose();
          }
        }, 500);
      } else {
        console.error("Authorization URL is null or undefined");
      }
    } catch (error) {
      console.error("Error during OAuth initialization:", error);
      this.showToast(
        "Error",
        "Error during OAuth initialization. Check console for details.",
        "error"
      );
    }
  }

  async initializeSFDCOAuth() {
    try {
      const sfdcauthorizationUrl = await getSFDCAuthorizationUrl({});
      if (sfdcauthorizationUrl) {
        let sfdcoauthWindow;
        sfdcoauthWindow = window.open(
          sfdcauthorizationUrl,
          "oauthWindow",
          "width=600,height=600"
        );

        // Listen for window close event to ensure the window is closed
        const checkWindowClosed = setInterval(() => {
          if (sfdcoauthWindow.closed) {
            // console.log('OAuth window closed.');
            clearInterval(checkWindowClosed);
            this.handleWindowClose();
          }
        }, 500);
      } else {
        console.error("Authorization URL is null or undefined");
      }
    } catch (error) {
      console.error("Error during OAuth initialization:", error);
      this.showToast(
        "Error",
        "Error during OAuth initialization. Check console for details.",
        "error"
      );
    }
  }

  async handleAuthCodeSubmit() {
    try {
      this.isOAuthInitialized = true;
      this.recentlyReinitializedOAuth = true; // Set the flag after OAuth reinitialization
      this.isAuthCodeModalOpen = false;
      if (this.metadataType === "Data") {
        this.isMarqDataPresent = true;
        this.accountExists = true;
      }
      await this.initializeTemplates();
      await this.refreshUserData();
    } catch (error) {
      console.error("Error during token retrieval:", error);
      if (error.body) {
        console.error("Error body:", error.body);
      }
      if (error.message) {
        console.error("Error message:", error.message);
      }
      this.showToast(
        "Error",
        "Error during token retrieval. Check console for details.",
        "error"
      );
      // this.isAuthCodeModalOpen = false; // Close the modal on failure
    }
  }

  async handleSFDCAuthCodeSubmit() {
    try {
      this.sfdcOauthExists = true;
    } catch (error) {
      console.error("Error during token retrieval:", error);
      if (error.body) {
        console.error("Error body:", error.body);
      }
      if (error.message) {
        console.error("Error message:", error.message);
      }
      this.showToast(
        "Error",
        "Error during token retrieval. Check console for details.",
        "error"
      );
      // this.isAuthCodeModalOpen = false; // Close the modal on failure
    }
  }

  closePublicLinkModal() {
    this.isPublicLinkModalOpen = false;
    this.currentPublicLink = "";
    this.currentTemplateName = "";
  }

  copyPublicLinkFromModal() {
    this.copyToClipboard(this.currentPublicLink);
    this.showToast("Success", "Public link copied to clipboard.", "success");
    this.isPublicLinkModalOpen = false;
    this.currentPublicLink = "";
  }

  handleWindowClose() {
    // Perform any cleanup or data refresh actions needed
    // this.refreshUserData();
  }

  handleAuthCodeChange(event) {
    this.authorizationCode = event.target.value;
  }

  handleAuthCodeCancel() {
    // this.isAuthCodeModalOpen = false;
  }

  refreshUserData() {
    getRecordNotifyChange([{ recordId: CURRENT_USER_ID }]);
    refreshApex();
  }

  //   updateTextboxFilters() {
  //     try {
  //         // Filter templates that don't have related content
  //         const templatesToFilter = this.allTemplates.filter(
  //             (template) => !template.hasRelatedContent
  //         );

  //         // Separate deleted templates
  //         const deletedTemplatesToFilter = templatesToFilter.filter((template) =>
  //             this.deletedTemplates.includes(template.id)
  //         );

  //         // Non-deleted templates
  //         const nonDeletedTemplatesToFilter = templatesToFilter.filter(
  //             (template) => !this.deletedTemplates.includes(template.id)
  //         );

  //         // Apply filters to the selected templates
  //         this.templates = this.applyFiltersToTemplates(nonDeletedTemplatesToFilter);

  //         // Sort templates alphabetically by name
  //         this.templates = this.templates.sort((a, b) =>
  //             a.name.localeCompare(b.name)
  //         );

  //         // Filter deleted templates if needed (optional)
  //         const filteredDeletedTemplates = this.applyFiltersToTemplates(deletedTemplatesToFilter);

  //         // Update displayed items
  //         this.updateDisplayedItems();

  //         // Optionally, process or display deleted templates separately
  //         console.log("Filtered Deleted Templates: ", filteredDeletedTemplates);
  //     } catch (error) {
  //         console.error("updateTextboxFilters: Error occurred:", error);
  //     }
  // }

  phrases = [
    "Syncing Marq with Salesforce",
    "Processing Salesforce details",
    "Associating to your record",
    "Applying template information"
  ];

  cycleLoadingText() {
    let index = 0;

    // Start cycling through phrases
    const interval = setInterval(() => {
      this.loadingText = this.phrases[index];
      index++;

      // Stop cycling after the last phrase
      if (index >= this.phrases.length) {
        clearInterval(interval);
      }
    }, 2000); // Change text every 2 seconds
  }

  updateTextboxFilters() {
    try {
      this.isFiltering = true; // Start filtering state

      // Filter templates that don't have related content
      const templatesToFilter = this.allTemplates.filter(
        (template) => !template.hasRelatedContent
      );

      // Apply filters to the selected templates
      this.templates = this.applyFiltersToTemplates(templatesToFilter);

      // Sort templates alphabetically by name
      this.templates = this.templates.sort((a, b) =>
        a.name.localeCompare(b.name)
      );

      // Update displayed items
      this.updateDisplayedItems();
    } catch (error) {
      console.error("updateTextboxFilters: Error occurred:", error);
    } finally {
      setTimeout(() => {
        this.isFiltering = false; // End filtering state
        this.templateisLoading = false;
      }, 500);
    }
  }

  // Getter to dynamically compute active filters
  get activeFilters() {
    const fields = this.textboxFields ? this.textboxFields.split(",") : [];
    const filters = this.textboxFilters ? this.textboxFilters.split(",") : [];

    return fields.map((field, index) => ({ field, value: filters[index] }));
  }

  handleRemoveFilter(event) {
    const index = parseInt(event.target.dataset.index, 10);

    // Split the current fields and filters into arrays
    const fields = this.textboxFields ? this.textboxFields.split(",") : [];
    const filters = this.textboxFilters ? this.textboxFilters.split(",") : [];

    // Save the removed filter
    this.deletedFilters.push({ field: fields[index], value: filters[index] });

    // Remove the filter at the specified index
    fields.splice(index, 1);
    filters.splice(index, 1);

    // Update the textboxFields and textboxFilters strings
    this.textboxFields = fields.join(",");
    this.textboxFilters = filters.join(",");

    // Call the function to update the displayed templates
    this.updateTextboxFilters();
  }

  applyFiltersToTemplates(templates) {
    const fieldsArray = this.textboxFields
      ? this.textboxFields.split(",").map((field) => field.trim())
      : [];
    const filtersArray = this.textboxFilters
      ? this.textboxFilters.split(",").map((filter) => filter.trim())
      : [];

    // Default to all templates if no fields/filters
    if (fieldsArray.length === 0 || filtersArray.length === 0) {
      console.warn(
        "No fields or filters provided. Defaulting to all templates."
      );
      return templates;
    }

    if (fieldsArray.length !== filtersArray.length) {
      console.warn(
        "Fields and filters do not match. Defaulting to unfiltered templates."
      );
      return templates;
    }

    const fieldFilterMap = this.buildFieldFilterMap(fieldsArray, filtersArray);

    const filterLogic =
      this.filterLogic || fieldsArray.map((_, index) => index + 1).join(" OR");

    // Apply filtering logic
    const filteredTemplates = templates.filter((template) => {
      return this.evaluateTemplate(
        template,
        fieldFilterMap,
        fieldsArray,
        filterLogic
      );
    });

    return filteredTemplates;
  }

  buildFieldFilterMap(fieldsArray, filtersArray) {
    const fieldFilterMap = {};
    fieldsArray.forEach((field, index) => {
      let fieldValue = null;

      // Handle specific fields manually
      if (field.toLowerCase() === "account.industry") {
        fieldValue = this.accountindustry;
      } else {
        fieldValue = this.recordData
          ? getFieldValue(this.recordData, field)
          : null;
      }

      if (fieldValue !== null && fieldValue !== undefined) {
        fieldFilterMap[field] = fieldValue.toLowerCase(); // Convert to lowercase
      } else {
        console.warn(`Field value for ${field} is missing or undefined.`);
      }
    });
    // console.log("Field Filter Map:", JSON.stringify(fieldFilterMap));
    return fieldFilterMap;
  }

  evaluateTemplate(template, fieldFilterMap, fieldsArray, filterLogic) {
    if (!template.categories || !Array.isArray(template.categories)) {
      return false;
    }

    const categoryValuesMap = this.buildCategoryValuesMap(template.categories);

    const tokens = this.tokenizeFilterLogic(filterLogic);

    return this.evaluateFilterLogic(
      tokens,
      fieldFilterMap,
      categoryValuesMap,
      fieldsArray
    );
  }

  buildCategoryValuesMap(categories) {
    const categoryValuesMap = {};
    categories.forEach((category) => {
      if (Array.isArray(category.values)) {
        category.values.forEach((value) => {
          categoryValuesMap[value.toLowerCase()] = true; // Convert to lowercase
        });
      }
    });
    return categoryValuesMap;
  }

  tokenizeFilterLogic(logic) {
    return (
      logic.match(/(\d+|\(|\)|AND|OR)/g)?.map((token) => token.trim()) || []
    );
  }

  evaluateFilterLogic(tokens, fieldFilterMap, categoryValuesMap, fieldsArray) {
    const stack = [];
    const operatorStack = [];
    const precedence = { AND: 2, OR: 1 };

    const applyOperator = () => {
      const operator = operatorStack.pop();
      const right = stack.pop();
      const left = stack.pop();
      stack.push(operator === "AND" ? left && right : left || right);
    };

    tokens.forEach((token) => {
      if (token === "(") {
        operatorStack.push(token);
      } else if (token === ")") {
        while (
          operatorStack.length &&
          operatorStack[operatorStack.length - 1] !== "("
        ) {
          applyOperator();
        }
        operatorStack.pop();
      } else if (["AND", "OR"].includes(token)) {
        while (
          operatorStack.length &&
          precedence[operatorStack[operatorStack.length - 1]] >=
            precedence[token]
        ) {
          applyOperator();
        }
        operatorStack.push(token);
      } else {
        const index = parseInt(token) - 1;
        const field = fieldsArray[index];
        const filterValue = fieldFilterMap[field];
        if (filterValue === null || filterValue === undefined) {
          console.warn(
            `Filter value for field ${field} is missing. Defaulting to true.`
          );
          stack.push(true); // Default to true to not exclude the template
        } else {
          const matches = categoryValuesMap.hasOwnProperty(
            filterValue.toLowerCase()
          );
          stack.push(matches);
        }
      }
    });

    while (operatorStack.length) {
      applyOperator();
    }

    return stack.length > 0 ? stack[0] : false;
  }

  updateDisplayedItems() {
    // Get all projects (related content) from allTemplates
    let filteredProjects = this.allTemplates.filter(
      (item) =>
        item.hasRelatedContent && !this.deletedTemplates.includes(item.id)
    );

    // Apply search term to projects
    if (this.searchTerm) {
      const lowerSearchTerm = this.searchTerm.toLowerCase();
      filteredProjects = filteredProjects.filter((project) => {
        return this.matchesSearchTerm(project, lowerSearchTerm);
      });
    }

    // Remove duplicates from filteredProjects
    filteredProjects = filteredProjects.filter(
      (t, index, self) => index === self.findIndex((tt) => tt.id === t.id)
    );

    // Sort projects by lastModifiedTimestamp descending
    filteredProjects.sort(
      (a, b) => b.lastModifiedTimestamp - a.lastModifiedTimestamp
    );

    // Apply search term to templates
    let filteredTemplates;
    if (this.searchTerm) {
      // Use allTemplates when searching, excluding projects and deleted templates
      filteredTemplates = this.allTemplates.filter(
        (template) =>
          !template.hasRelatedContent &&
          !this.deletedTemplates.includes(template.id)
      );
    } else {
      // Use the templates filtered by textbox filters
      filteredTemplates = [...this.templates];
    }

    if (this.searchTerm) {
      const lowerSearchTerm = this.searchTerm.toLowerCase();
      filteredTemplates = filteredTemplates.filter((template) => {
        return this.matchesSearchTerm(template, lowerSearchTerm);
      });
    }

    // Remove duplicates from filteredTemplates
    filteredTemplates = filteredTemplates.filter(
      (t, index, self) => index === self.findIndex((tt) => tt.id === t.id)
    );

    // Update displayedProjects and displayedTemplates
    this.displayedProjects = filteredProjects;
    this.displayedTemplates = filteredTemplates.slice(
      0,
      this.currentOffset || 10
    );
  }

  matchesSearchTerm(item, lowerSearchTerm) {
    const name = item.name || "";
    const title = item.title || "";
    const categories = item.categories || [];

    const matchesName = name.toLowerCase().includes(lowerSearchTerm);
    const matchesTitle = title.toLowerCase().includes(lowerSearchTerm);
    const matchesCategories = categories.some((category) =>
      category.values?.some((value) =>
        value.toLowerCase().includes(lowerSearchTerm)
      )
    );

    return matchesName || matchesTitle || matchesCategories;
  }

  async loadAllTemplates() {
    const sourceTemplates = this.allTemplates;
    const totalTemplates = sourceTemplates.length;
    const batchSize = this.loadCount || 6;
    let batchIndex = 0;

    const loadBatch = () => {
      if (batchIndex < totalTemplates) {
        const start = batchIndex;
        const end = Math.min(batchIndex + batchSize, totalTemplates);
        const batch = sourceTemplates.slice(start, end);

        // Update allTemplates with the batch
        // Prevent duplicates using a Map
        const templatesMap = new Map(this.allTemplates.map((t) => [t.id, t]));
        batch.forEach((template) => {
          templatesMap.set(template.id, template);
        });
        this.allTemplates = Array.from(templatesMap.values());

        // Check related content in batch
        this.checkRelatedContentBatch(batch);

        batchIndex += batchSize;

        setTimeout(loadBatch, 0);
      } else {
        this.updateDisplayedItems(); // Update displayed items after loading
      }
    };

    loadBatch();
  }

  async checkRelatedContentBatch(batch) {
    this.isCheckingContent = true;
    try {
      for (const template of batch) {
        const templateKey = `${template.id}-${this.recordId}`;

        // Use cached recent changes if available
        if (this.recentChanges[templateKey]) {
          const recentChange = this.recentChanges[templateKey];
          template.projectId = recentChange.projectId;
          template.title = recentChange.projectName || template.name;
          template.name = recentChange.projectName || template.name;
          template.contentVersionId = recentChange.contentVersionId;
          template.buttonLabel = "Edit";
          template.viewButtonLabel = "View";
          template.linkLabel = "Create Public Link";
          template.isEdit = true;
          template.image = `https://thumbs.app.marq.com/documents/thumb/${recentChange.projectId}/0/2048/NULL/200/true?clipToPage=true&useLargePdfPageFallback=false`;
          template.hasRelatedContent = true;
          template.publicLink = recentChange.publicLink || null; // Ensure null if not available
          template.lastModifiedDate = recentChange.lastModifiedDate
            ? (() => {
                const date = new Date(recentChange.lastModifiedDate);
                template.lastModifiedTimestamp = date.getTime(); // Store timestamp for sorting
                const options = {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "numeric",
                  hour12: true,
                  timeZoneName: "short"
                };
                return date.toLocaleString(undefined, options);
              })()
            : null;
        } else {
          try {
            const contentVersionWrapper =
              await findRelatedContentVersionByTemplateKey({ templateKey });

            // Update the template properties
            template.hasRelatedContent =
              !!contentVersionWrapper.contentVersionId;
            template.projectId = contentVersionWrapper
              ? contentVersionWrapper.projectId
              : null;
            template.title =
              contentVersionWrapper?.contenttitle || template.name;
            template.name =
              contentVersionWrapper?.contenttitle || template.name;
            template.contentVersionId =
              contentVersionWrapper?.contentVersionId || null;
            template.publicLink = contentVersionWrapper?.publicLink || null; // Ensure null if no link exists

            // Set button labels based on project presence
            template.buttonLabel = template.projectId ? "Edit" : "Create New";
            template.linkLabel = template.publicLink
              ? "Create public link"
              : "Create public link";
            template.viewButtonLabel = template.projectId ? "View" : null;
            template.isEdit = !!template.projectId;

            // Update the image URL
            template.image = template.projectId
              ? `https://thumbs.app.marq.com/documents/thumb/${template.projectId}/0/2048/NULL/200/true?clipToPage=true&useLargePdfPageFallback=false`
              : `https://thumbs.app.marq.com/documents/thumb/${template.id}/0/2048/NULL/200/true?clipToPage=true&useLargePdfPageFallback=false`;

            template.lastModifiedDate = contentVersionWrapper?.lastModifiedDate
              ? (() => {
                  const date = new Date(contentVersionWrapper.lastModifiedDate);
                  template.lastModifiedTimestamp = date.getTime(); // Store timestamp for sorting
                  const options = {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "numeric",
                    hour12: true,
                    timeZoneName: "short"
                  };
                  return date.toLocaleString(undefined, options);
                })()
              : null;
          } catch (error) {
            // Handle cases where no related content is found
            template.hasRelatedContent = false;
            template.buttonLabel = "Create New";
            template.viewButtonLabel = null;
            template.isEdit = false;
            template.image = `https://thumbs.app.marq.com/documents/thumb/${template.id}/0/2048/NULL/200/true?clipToPage=true&useLargePdfPageFallback=false`;
            template.publicLink = null; // Ensure null if no link exists
            template.lastModifiedDate = null;
            template.lastModifiedTimestamp = 0;
          }
        }

        // Update the corresponding template in allTemplates
        const indexInAllTemplates = this.allTemplates.findIndex(
          (t) => t.id === template.id
        );
        if (indexInAllTemplates !== -1) {
          this.allTemplates[indexInAllTemplates] = {
            ...this.allTemplates[indexInAllTemplates],
            ...template
          };
        }
      }

      // After processing the batch, remove duplicates from allTemplates
      this.allTemplates = this.allTemplates.filter(
        (t, index, self) => index === self.findIndex((tt) => tt.id === t.id)
      );

      // After processing the batch, update displayed items
      this.updateDisplayedItems();
    } finally {
      this.isCheckingContent = false;
    }
  }

  handleLogout() {
    try {
      // Open the logout URL in a new window
      const logoutWindow = window.open(
        "https://app.marq.com/users/logout",
        "_blank"
      );

      // Automatically close the window after a short delay (e.g., 2 seconds)
      setTimeout(() => {
        if (logoutWindow) {
          logoutWindow.close();
        }

        // Reset all relevant properties to their initial state
        this.marqUserId = null;
        this.templatesFeed = null;
        this.lastTemplatSyncDate = null;
        this.isOAuthInitialized = false;
        this.userExists = false;
        this.forceSync = true;

        // Clear projects-related data
        this.displayedProjects = [];

        // Clear all template-related data
        this.templates = [];
        this.filteredTemplates = []; // Ensure this is explicitly reset
        this.displayedTemplates = [];
        this.allTemplates = [];
        this.deletedTemplates = [];
        this.recentChanges = {};

        // Update the UI
        this.updateDisplayedItems();

        // Delete user record
        this.deleteMarqUserRecord();

        this.showToast("Success", "Logged out successfully", "success");
      }, 500);
    } catch (error) {
      console.error("Error during logout:", error);
      this.showToast(
        "Error",
        "An error occurred during logout. Check console for details.",
        "error"
      );
    }
  }

  async handleForceSyncTemplates() {
    try {
      this.isSyncing = true;
      this.forceSync = true;

      await this.initializeTemplates();

      // Restore deleted filters if any
      if (this.deletedFilters.length > 0) {
        const fields = this.textboxFields ? this.textboxFields.split(",") : [];
        const filters = this.textboxFilters
          ? this.textboxFilters.split(",")
          : [];

        this.deletedFilters.forEach(({ field, value }) => {
          if (!fields.includes(field)) {
            fields.push(field);
            filters.push(value);
          }
        });

        // Update the filters
        this.textboxFields = fields.join(",");
        this.textboxFilters = filters.join(",");

        // Clear the deleted filters history after restoring
        this.deletedFilters = [];

        this.updateTextboxFilters();
      }
    } catch (error) {
      console.error("Error during force sync:", error);
    } finally {
      this.isSyncing = false;
    }
  }

  get syncIconClass() {
    return this.isSyncing ? "syncing" : "";
  }

  async fetchTemplates() {
    if (!this.isOAuthInitialized) {
      console.error("OAuth is not initialized");
      return;
    }

    try {
      // Use the `forceSync` flag to bypass the last sync date check
      const needsSync =
        this.forceSync ||
        this.shouldSyncTemplates(this.lastTemplatSyncDate, this.templatesFeed);

      if (needsSync) {
        await this.syncTemplates();
        this.forceSync = false; // Reset the flag after forcing sync
      }

      if (this.templatesFeed) {
        await this.loadTemplatesFromFeed(this.templatesFeed);
      } else {
        console.error("Templates feed is unavailable.");
      }
    } catch (error) {
      console.error("Error fetching templates:", error);
      this.showToast(
        "Error",
        "Error fetching templates. Check console for details.",
        "error"
      );
    } finally {
      this.updateTextboxFilters();
    }
  }

  // Check if templates need to be synced based on the last sync date
  shouldSyncTemplates(lastSyncDateString, templatesFeed) {
    if (!templatesFeed) return true;

    const lastSyncDate = lastSyncDateString
      ? new Date(lastSyncDateString)
      : null;
    if (!lastSyncDate) return true;

    const currentTime = new Date();
    const timeDiff = currentTime - lastSyncDate;
    const hoursDiff = timeDiff / (1000 * 60 * 60);

    // Sync if more than 24 hours have passed
    return hoursDiff >= 24;
  }

  // Simulates syncing templates (could involve API call)
  async syncTemplates() {
    try {
      //   console.log("Syncing templates...");

      // Call the Apex method and parse the result
      const syncResult = await fetchAndStoreTemplates();

      // Check for successful response
      if (syncResult.status === "Success") {
        // Update the tracked properties with the returned values
        this.templatesFeed = syncResult.templatesjsonurl ?? null;
        this.lastTemplatSyncDate = syncResult.lasttemplatesyncdate ?? null;

        // console.log("Templates synced successfully.");
        // console.log("Templates Feed URL:", this.templatesFeed);
        // console.log("Last Template Sync Date:", this.lastTemplatSyncDate);
      } else {
        // Log and display an error message if the sync fails
        console.error("Template sync failed:", syncResult.error);
        this.showToast(
          "Error",
          `Template sync failed: ${syncResult.error}`,
          "error"
        );
      }
    } catch (error) {
      // Handle unexpected errors
      console.error("Error syncing templates:", error);
      this.showToast(
        "Error",
        "An error occurred while syncing templates. Check console for details.",
        "error"
      );
      throw error;
    }
  }

  async loadTemplatesFromFeed(templatesFeed) {
    try {
      const response = await fetchTemplatesfromMarq({
        templatesUrl: templatesFeed
      });
      const templatesData = JSON.parse(response);

      if (Array.isArray(templatesData.templatesresponse)) {
        const newTemplates = templatesData.templatesresponse.map((template) => {
          const existingTemplate = this.allTemplates.find(
            (t) => t.id === template.id
          );
          return {
            ...existingTemplate,
            id: template.id,
            name: template.title,
            categories: template.categories,
            image:
              existingTemplate && existingTemplate.image
                ? existingTemplate.image
                : `https://thumbs.app.marq.com/documents/thumb/${template.id}/0/2048/NULL/200/true?clipToPage=true&useLargePdfPageFallback=false`,
            hasRelatedContent: existingTemplate
              ? existingTemplate.hasRelatedContent
              : false,
            buttonLabel: existingTemplate
              ? existingTemplate.buttonLabel
              : "Create New",
            viewButtonLabel: existingTemplate
              ? existingTemplate.viewButtonLabel
              : "View",
            isEdit: existingTemplate ? existingTemplate.isEdit : false,
            projectId: existingTemplate ? existingTemplate.projectId : null,
            contentVersionId: existingTemplate
              ? existingTemplate.contentVersionId
              : null,
            publicLink: existingTemplate ? existingTemplate.publicLink : null
          };
        });
        this.allTemplates = newTemplates;
        // console.log(
        //   "Templates successfully loaded:",
        //   JSON.stringify(newTemplates)
        // );
      } else {
        console.error(
          "Templates data is not an array:",
          JSON.stringify(templatesData)
        );
        this.templates = [];
        this.allTemplates = [];
      }
    } catch (error) {
      console.error("Error loading templates from feed:", error);
      this.showToast(
        "Error",
        "Error loading templates. Check console for details.",
        "error"
      );
    }
  }

  // Handle image click
  handleImageClick(event) {
    const templateId = event.currentTarget.dataset.id;
    const templateName = event.currentTarget.dataset.name;
    const projectId = event.currentTarget.dataset.projectId;
    const hasRelatedContent =
      event.currentTarget.dataset.hasRelatedContent === "true";

    this.openModalById({
      id: templateId,
      name: templateName,
      projectId: projectId,
      hasRelatedContent: hasRelatedContent
    });
  }

  // Handle title click
  handleTitleClick(event) {
    const templateId = event.currentTarget.dataset.id;
    const templateName = event.currentTarget.dataset.name;
    const projectId = event.currentTarget.dataset.projectId;
    const hasRelatedContent =
      event.currentTarget.dataset.hasRelatedContent === "true";

    this.openModalById({
      id: templateId,
      name: templateName,
      projectId: projectId,
      hasRelatedContent: hasRelatedContent
    });
  }

  handleMenuSelect(event) {
    const selectedAction = event.detail.value;
    const menuElement = event.currentTarget;

    const {
      id: templateId,
      projectId,
      contentVersionId,
      publicLink,
      name: templateName,
      hasRelatedContent
    } = menuElement.dataset;
    const hasRelated = hasRelatedContent === "true";

    switch (selectedAction) {
      case "edit":
        this.openModalById({
          id: templateId,
          name: templateName,
          projectId,
          hasRelatedContent: hasRelated
        });
        break;

      case "present":
        const presentUrl = `https://app.marq.com/documents/view/${templateId}`;
        window.open(presentUrl, "_blank");
        break;

      case "view":
        this.viewContentVersionById(contentVersionId);
        break;

      case "createPublicLink":
        this.publishFileById(contentVersionId, templateName, templateId);
        break;

      case "copyPublicLink":
        this.handleCopyPublicLink(publicLink, templateName);
        break;

      case "delete":
        this.deleteFileById(projectId, contentVersionId, templateId);
        break;

      default:
        console.warn("Unknown action:", selectedAction);
    }
  }

  addPublicLinkToRecentChanges(templateId, recordId, updates) {
    const templateKey = `${templateId}-${recordId}`;

    if (!this.recentChanges[templateKey]) {
      this.recentChanges[templateKey] = {};
    }

    // Update the public link
    if (updates.publicLink) {
      this.recentChanges[templateKey].publicLink = updates.publicLink;
    }

    // Update the last modified date (current date and time)
    this.recentChanges[templateKey].lastModifiedDate = new Date().toISOString();

    // Update the template in allTemplates
    const templateIndex = this.allTemplates.findIndex(
      (t) => t.id === templateId
    );
    if (templateIndex !== -1) {
      this.allTemplates[templateIndex].publicLink = updates.publicLink;
      // Trigger reactivity
      this.allTemplates = [...this.allTemplates];
    }

    // Update the template in displayedProjects
    const projectIndex = this.displayedProjects.findIndex(
      (t) => t.id === templateId
    );
    if (projectIndex !== -1) {
      this.displayedProjects[projectIndex].publicLink = updates.publicLink;
      // Trigger reactivity
      this.displayedProjects = [...this.displayedProjects];
    }

    this.updateDisplayedItems();
  }

  handleCopy(event) {
    // Prevent the default copy action
    event.preventDefault();
    this.showToast("Error", `Please use the copy to clipboard button`);
  }
  handleContextMenu(event) {
    event.preventDefault();
    this.showToast("Error", `Please use the copy to clipboard button`);
  }

  handleViewPublicLink(event) {
    const publicLink = event.target.dataset.publicLink;
    if (publicLink) {
      window.open(publicLink, "_blank"); // Opens the link in a new tab
    } else {
      this.showToast("Error", "No public link available.", "error");
    }
  }

  async publishFileById(contentVersionId, templateName, templateId) {
    try {
      // Check if contentVersionId exists for the related content
      if (!contentVersionId) {
        console.warn(
          "No ContentVersionId provided. Attempting to fetch related content version..."
        );

        const relatedContent = await findRelatedContentVersionByTemplateKey({
          templateKey: `${templateId}-${this.recordId}`
        });

        if (relatedContent && relatedContent.contentVersionId) {
          contentVersionId = relatedContent.contentVersionId; // Use the fetched contentVersionId
        } else {
          throw new Error(
            "Related content version not found for the template."
          );
        }
      }

      // Check if a public link already exists
      if (this.publishedLinks[templateId]) {
        this.handleCopyPublicLink(
          this.publishedLinks[templateId],
          templateName
        );
        return;
      }

      // Proceed to create the public link
      const response = await createContentDelivery({
        contentVersionId,
        projectName: templateName
      });

      const parsedResponse = JSON.parse(response);

      if (
        parsedResponse.success === "true" &&
        parsedResponse.contentPublicUrl
      ) {
        const publicUrl = parsedResponse.contentPublicUrl;

        // Cache the link for future use
        this.publishedLinks[templateId] = publicUrl;
        this.currentPublicLink = publicUrl; // Set the link for the modal
        this.currentTemplateName = templateName;
        this.isPublicLinkModalOpen = true; // Open the modal

        // Update the recentChanges using the helper function
        this.addPublicLinkToRecentChanges(templateId, this.recordId, {
          publicLink: publicUrl
        });
      } else {
        throw new Error(
          parsedResponse.error || "Failed to create public link."
        );
      }
    } catch (error) {
      console.error("Error during public link creation:", error);
      this.showToast(
        "Error",
        `Failed to create public link: ${error.message}`,
        "error"
      );
    }
  }

  handleModalCopyPublicLink(event) {
    event.preventDefault();

    const publicLink = event.target.dataset.publicLink;
    const templateName = event.target.dataset.templateName;

    if (publicLink) {
      const emailCompatibleLink = `<a href="${publicLink}" target="_blank">${templateName}</a>`;
      this.copyToClipboard(emailCompatibleLink, true);
      this.showToast("Success", "Public link copied to clipboard.", "success");
      this.closePublicLinkModal();
    } else {
      this.showToast("Error", "No public link available.", "error");
    }
  }

  handleCopyPublicLink(publicLink, templateName) {
    if (publicLink) {
      const emailCompatibleLink = `<a href="${publicLink}" target="_blank">${templateName}</a>`;
      this.copyToClipboard(emailCompatibleLink, true);
      this.showToast("Success", "Public link copied to clipboard.", "success");
      this.closePublicLinkModal();
    } else {
      this.showToast("Error", "No public link available.", "error");
    }
  }

  copyToClipboard(text, isHtml = false) {
    if (navigator.clipboard && window.isSecureContext) {
      const type = isHtml ? "text/html" : "text/plain";
      const blob = new Blob([text], { type });
      const data = [new ClipboardItem({ [type]: blob })];
      navigator.clipboard
        .write(data)
        .catch((err) => console.error("Failed to write to clipboard", err));
    } else {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed"; // Prevent scrolling
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      try {
        document.execCommand("copy");
      } catch (err) {
        console.error("Fallback copy failed", err);
      }
      document.body.removeChild(textarea);
    }
  }

  updateLabelText(templateId, newLabel) {
    // Update in displayedTemplates
    const template = this.displayedTemplates.find(
      (template) => template.id === templateId
    );
    if (template) {
      template.linkLabel = newLabel;
    }

    // Update in allTemplates
    const allTemplate = this.allTemplates.find(
      (template) => template.id === templateId
    );
    if (allTemplate) {
      allTemplate.linkLabel = newLabel;
    }

    // Update in recentChanges if it exists
    const recentChangeKey = `${templateId}-${this.recordId}`;
    if (this.recentChanges[recentChangeKey]) {
      this.recentChanges[recentChangeKey].linkLabel = newLabel;
    }
  }

  updateDisplayedTemplatesAfterDeletion() {
    const filteredTemplates = this.allTemplates.filter((template) => {
      // Include templates if:
      // 1. They have related content (projects)
      // 2. They are not in the deletedTemplates array
      // 3. They match any filter or search logic (filteredTemplates)

      return (
        template.hasRelatedContent || // Include related content explicitly
        !this.deletedTemplates.includes(template.id) || // Exclude deleted templates
        this.filteredTemplates.some(
          (filteredTemplate) => filteredTemplate.id === template.id
        )
      );
    });

    const newDisplayedTemplates = filteredTemplates.filter(
      (template) => !template.hasRelatedContent
    );

    // Merge newDisplayedTemplates with existing displayedTemplates
    this.displayedTemplates = [
      ...this.displayedTemplates.filter(
        (template) => !newDisplayedTemplates.some((t) => t.id === template.id)
      ),
      ...newDisplayedTemplates
    ].slice(0, this.currentOffset || 10);
  }

  async handleAccountAction() {
    await this.handleAccountAuthorizeClick();
  }

  async handleAdminAction() {
    if (!this.sfdcOauthExists) {
      await this.handleSFDCAuthorizeClick();
    }
    if (!this.accountExists) {
      this.metadataType = "data";
      await this.handleAccountAuthorizeClick();
    }
    this.isSettingsModalOpen = true; // Open the modal after authorization
  }

  async openModalById({ id, name, projectId, hasRelatedContent }) {
    try {
      // Reset selected template values
      this.selectedTemplateName = name;
      this.selectedTemplateId = id;

      // Open the modal and add the event listener
      this.isModalOpen = true;
      window.addEventListener("message", this.handleWindowMessage.bind(this));

      // Set loading state for the iframe
      this.isLoading = true;
      this.cycleLoadingText();

      if (hasRelatedContent) {
        await this.setupIframeSourceForEdit(id, projectId);
      } else {
        await this.setupIframeSourceForCreate(id, name);
      }
    } catch (error) {
      console.error("Error in openModal:", error);
      this.isLoading = false; // Ensure loading state is removed in case of error
    }
  }

  async viewContentVersionById(contentVersionId) {
    try {
      if (contentVersionId) {
        const contentDocumentId = await findContentDocumentId({
          contentVersionId
        });
        if (contentDocumentId) {
          // Navigate to the Content Document record page
          this[NavigationMixin.Navigate]({
            type: "standard__recordPage",
            attributes: {
              recordId: contentDocumentId,
              actionName: "view"
            }
          });
        } else {
          console.error("Content document ID not found");
        }
      } else {
        console.error("Content version ID is missing");
      }
    } catch (error) {
      console.error("Error fetching content document ID:", error);
    }
  }

  async deleteFileById(projectId, contentVersionId, templateId) {
    try {
      //   console.log("deleteFileById called with:", {
      //     projectId,
      //     contentVersionId,
      //     templateId,
      //   });

      // Call the Apex method to delete the project or content version
      await deleteProjectOrContent({
        projectId: projectId,
        contentVersionId: contentVersionId
      });
      this.showToast("Success", "File deleted successfully", "success");

      // Update the template in allTemplates
      const templateIndex = this.allTemplates.findIndex(
        (t) => t.id === templateId
      );
      if (templateIndex > -1) {
        this.allTemplates[templateIndex] = {
          ...this.allTemplates[templateIndex],
          hasRelatedContent: false,
          projectId: null,
          contentVersionId: null,
          buttonLabel: "Create New",
          viewButtonLabel: null,
          isEdit: false,
          image: `https://thumbs.app.marq.com/documents/thumb/${templateId}/0/2048/NULL/200/true?clipToPage=true&useLargePdfPageFallback=false`,
          lastModifiedDate: null,
          lastModifiedTimestamp: 0
        };

        // Remove from displayedProjects
        this.displayedProjects = this.displayedProjects.filter(
          (project) => project.id !== templateId
        );

        if (
          this.matchesSearchTerm(
            this.allTemplates[templateIndex],
            this.searchTerm
          ) &&
          !this.displayedTemplates.find((t) => t.id === templateId)
        ) {
          this.displayedTemplates = [
            ...this.displayedTemplates,
            this.allTemplates[templateIndex]
          ];
        }

        // Add the deleted template ID to `deletedTemplates`
        if (!this.deletedTemplates.includes(templateId)) {
          this.deletedTemplates.push(templateId);
        }

        this.allTemplates = [...this.allTemplates]; // Trigger reactivity
      }

      // Remove from recentChanges to prevent stale data
      const templateKey = `${templateId}-${this.recordId}`;
      delete this.recentChanges[templateKey];
      this.recentChanges = { ...this.recentChanges };

      // Reapply filters to update displayedTemplates
      this.updateTextboxFilters();

      // Explicitly check if the template should be in displayedTemplates
      const updatedTemplate = this.allTemplates.find(
        (t) => t.id === templateId
      );
      if (updatedTemplate) {
        const lowerSearchTerm = this.searchTerm
          ? this.searchTerm.toLowerCase()
          : null;
        const matchesSearch = lowerSearchTerm
          ? (updatedTemplate.name &&
              updatedTemplate.name.toLowerCase().includes(lowerSearchTerm)) ||
            (updatedTemplate.title &&
              updatedTemplate.title.toLowerCase().includes(lowerSearchTerm)) ||
            (updatedTemplate.categories &&
              updatedTemplate.categories.some((category) =>
                category.values?.some((value) =>
                  value.toLowerCase().includes(lowerSearchTerm)
                )
              ))
          : true;

        if (matchesSearch) {
          if (!this.displayedTemplates.find((t) => t.id === templateId)) {
            this.displayedTemplates = [
              ...this.displayedTemplates,
              this.allTemplates[templateIndex]
            ];
          }
        }
      }
    } catch (error) {
      let errorMessage = "Unknown error";
      if (error.body && error.body.message) {
        errorMessage = error.body.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      console.error("Error deleting file:", error);
      this.showToast(
        "Error",
        "Failed to delete file: " + errorMessage,
        "error"
      );
    }
  }

  async processCustomFields() {
    if (!this.customFields) {
      console.error("customFields are not set");
      return;
    }

    const fieldsArray = this.customFields
      .split(",")
      .map((field) => field.trim());

    const fieldValues = {};
    fieldsArray.forEach((field) => {
      const fieldValue = getFieldValue(this.recordDataForCustomFields, field);
      if (fieldValue !== undefined) {
        fieldValues[field] = fieldValue;
      }
    });

    // console.log('Processed custom field values:', JSON.stringify(fieldValues));

    // Store the custom field values for use in sendData
    this.customFieldValues = fieldValues;
  }

  async sendData() {
    if (!this.isMarqDataPresent) {
      console.warn(
        "Marq data is not ready. The method execution will be skipped."
      );
      return;
    }

    try {
      // Prepare record properties
      const recordProperties = {
        Id: this.recordId,
        "Marq User Restriction": this.userEmail,
        Name: this.accountname,
        Logo: this.accountlogo,
        Industry: this.accountindustry
      };

      const imageFields = ["Logo"];

      // Add custom field values to recordProperties and identify image fields
      if (this.customFieldValues) {
        for (const [field, value] of Object.entries(this.customFieldValues)) {
          if (value !== undefined) {
            const fieldName = field.split(".").pop();
            let fieldValue = value;

            // Check if the field is a number and has a displayValue
            const fieldData = this.recordDataForCustomFields.fields[fieldName];
            if (
              fieldData &&
              typeof fieldData.value === "number" &&
              fieldData.displayValue
            ) {
              fieldValue = fieldData.displayValue;
            }

            recordProperties[fieldName] = fieldValue;

            // Identify image-related fields
            const lowerCaseFieldName = fieldName.toLowerCase();
            if (
              lowerCaseFieldName.includes("logo") ||
              lowerCaseFieldName.includes("img") ||
              lowerCaseFieldName.includes("image")
            ) {
              imageFields.push(fieldName);
            }
          }
        }
      }

      // Assign the identified image fields to ImageFields
      recordProperties["ImageFields"] = imageFields.join(",");

      // Prepare the schema dynamically based on customFields
      const schema = [
        { name: "Id", fieldType: "STRING", isPrimary: true, order: 1 },
        { name: "Name", fieldType: "STRING", isPrimary: false, order: 2 },
        { name: "Logo", fieldType: "STRING", isPrimary: false, order: 3 },
        { name: "Industry", fieldType: "STRING", isPrimary: false, order: 4 },
        {
          name: "Marq User Restriction",
          fieldType: "STRING",
          isPrimary: false,
          order: 5
        }
      ];

      if (this.objectName === "Opportunity") {
        await this.fetchOpportunityProducts();

        // Add products dynamically to recordProperties with placeholders
        for (let i = 0; i < 10; i++) {
          if (this.products[i]) {
            const product = this.products[i];

            // Create a currency formatter for the product's currency
            const currencyFormatter = new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: product.currencyIsoCode,
              minimumFractionDigits: 2
            });

            recordProperties[`Product_${i + 1}_Name`] = product.name;
            recordProperties[`Product_${i + 1}_Quantity`] = product.quantity;
            recordProperties[`Product_${i + 1}_Price`] =
              currencyFormatter.format(product.price);
            recordProperties[`Product_${i + 1}_Date`] = product.date;
          } else {
            // Placeholder values for missing products
            recordProperties[`Product_${i + 1}_Name`] = "";
            recordProperties[`Product_${i + 1}_Quantity`] = "";
            recordProperties[`Product_${i + 1}_Price`] = "";
            recordProperties[`Product_${i + 1}_Date`] = "";
          }
        }

        // Update the schema to include placeholders for 10 products
        for (let i = 0; i < 10; i++) {
          schema.push({
            name: `Product_${i + 1}_Name`,
            fieldType: "STRING",
            isPrimary: false,
            order: schema.length + 1
          });
          schema.push({
            name: `Product_${i + 1}_Quantity`,
            fieldType: "STRING",
            isPrimary: false,
            order: schema.length + 1
          });
          schema.push({
            name: `Product_${i + 1}_Price`,
            fieldType: "STRING",
            isPrimary: false,
            order: schema.length + 1
          });
          schema.push({
            name: `Product_${i + 1}_Date`,
            fieldType: "STRING",
            isPrimary: false,
            order: schema.length + 1
          });
        }
      }

      // console.log('Final record properties:', JSON.stringify(recordProperties));

      if (this.customFields) {
        const fieldsArray = this.customFields
          .split(",")
          .map((field) => field.trim());
        fieldsArray.forEach((field) => {
          const fieldName = field.split(".").pop(); // Get the actual field name without the relationship prefix
          let fieldType = "STRING"; // Default field type

          // Check if field name contains logo, img, or image (case-insensitive)
          const lowerCaseFieldName = fieldName.toLowerCase();
          if (
            lowerCaseFieldName.includes("logo") ||
            lowerCaseFieldName.includes("img") ||
            lowerCaseFieldName.includes("image")
          ) {
            fieldType = "STRING"; //set as "IMAGE" when we get that working
          }

          schema.push({
            name: fieldName,
            fieldType: fieldType,
            isPrimary: false,
            order: schema.length + 1
          });
        });
      }

      await sendDataToEndpoint({
        objectName: this.objectName,
        properties: recordProperties,
        schema: schema
      });
    } catch (error) {
      console.error("Error in sendData function:", error);
      // this.resetDataInitialization();
    }
  }

  async fetchObjectName() {
    try {
      this.objectName = await getObjectName({ recordId: this.recordId });
      if (this.wiredRecordResult) {
        await refreshApex(this.wiredRecordResult);
      }
    } catch (error) {
      console.error("Error retrieving object name:", error);
    }
  }

  async connectedCallback() {
    await this.fetchObjectName();
    await this.handleAsyncOperations();

    this.isInAppBuilder = window.location.href.includes("flexipageEditor");

    try {
      const orgId = await getOrgId();
      if (orgId) {
        const url = new URL(this.linkUrl);
        url.searchParams.set("salesforceaccountid", orgId); // Append orgId as a query parameter
        this.linkUrl = url.toString();
      } else {
        console.warn("Organization ID could not be retrieved.");
      }
    } catch (error) {
      console.error("Error retrieving or processing Organization ID:", error);
    }

    //    // Check for admin permissions
    //    try {
    //     this.isAdmin = await hasAdminPermission(); // Call the Apex method
    // } catch (error) {
    //     console.error("Error fetching admin permission:", error);
    //     this.isAdmin = false; // Default to false on error
    // }

    try {
      window.addEventListener("message", (event) => {
        const allowedOrigin = "https://info.marq.com"; // Update to match your allowed origin

        if (event.origin !== allowedOrigin) return;

        if (event.data.type === "OAuthSuccess") {
          this.authorizationCode = event.data.authorizationCode;
          this.handleAuthCodeSubmit(); // Handle success as per your existing flow
        } else if (event.data.type === "OAuthFailure") {
          console.error("OAuth process failed:", event.data.error);
          this.showToast(
            "Error",
            "OAuth process failed: " + event.data.error,
            "error"
          );
        }

        if (event.data.type === "SFDC_OAuthSuccess") {
          this.authorizationCode = event.data.authorizationCode;
          this.handleSFDCAuthCodeSubmit(); // Handle success as per your existing flow
        } else if (event.data.type === "SFDC_OAuthFailure") {
          console.error("OAuth process failed:", event.data.error);
          this.showToast(
            "Error",
            "OAuth process failed: " + event.data.error,
            "error"
          );
        }
      });

      window.addEventListener("beforeunload", this.cleanup.bind(this));

      // Fetch available fields
      this.availableFields = await getAvailableFields({
        objectName: this.objectName
      });
      // console.log('Available fields fetched:', JSON.stringify(this.availableFields));

      this.refreshHandlerID = registerRefreshHandler(
        this.template.host,
        this.refreshHandler.bind(this)
      );
    } catch (error) {
      console.error("Error in connectedCallback:", error); // Log the actual error object
    }
  }

  disconnectedCallback() {
    unregisterRefreshHandler(this.refreshHandlerID);
    window.removeEventListener("message", this.handleWindowMessage.bind(this));
    window.removeEventListener("beforeunload", this.cleanup.bind(this));
  }

  async fetchRelatedRecords() {
    if (!this.customFields) return;

    const fieldsArray = this.customFields
      .split(",")
      .map((field) => field.trim());

    try {
      const result = await getRelatedRecords({
        parentRecordId: this.recordId,
        customFields: fieldsArray
      });
      // console.log('Related Records:', JSON.stringify(result));
      this.relatedRecords = result; // Store the result in a tracked property
    } catch (error) {
      console.error("Error fetching related records:", JSON.stringify(error));
    }
  }

  // Computed classes for tabs
  get projectsTabClass() {
    return this.activeTab === "projects"
      ? "slds-tabs_default__item slds-is-active"
      : "slds-tabs_default__item";
  }

  get templatesTabClass() {
    return this.activeTab === "templates"
      ? "slds-tabs_default__item slds-is-active"
      : "slds-tabs_default__item";
  }

  // Computed classes for tab content
  get projectsTabContentClass() {
    return this.activeTab === "projects"
      ? "slds-tabs_default__content slds-show"
      : "slds-tabs_default__content slds-hide";
  }

  get templatesTabContentClass() {
    return this.activeTab === "templates"
      ? "slds-tabs_default__content slds-show"
      : "slds-tabs_default__content slds-hide";
  }

  get hasProjects() {
    return this.displayedProjects && this.displayedProjects.length > 0;
  }

  get hasTemplates() {
    return (
      this.displayedTemplates &&
      this.displayedTemplates.some((template) => !template.hasRelatedContent)
    );
  }

  viewContentVersion(event) {
    try {
      const contentVersionId = event.currentTarget.dataset.contentVersionId;
      // console.log('Content Version ID:', contentVersionId); // Log the content version ID

      if (contentVersionId) {
        // Fetch the ContentDocumentId related to the ContentVersion
        findContentDocumentId({ contentVersionId })
          .then((contentDocumentId) => {
            // console.log('Content Document ID:', contentDocumentId); // Log the content document ID
            if (contentDocumentId) {
              // Navigate to the Content Document record page
              this[NavigationMixin.Navigate]({
                type: "standard__recordPage",
                attributes: {
                  recordId: contentDocumentId,
                  actionName: "view"
                }
              });
            } else {
              console.error("Content document ID not found");
            }
          })
          .catch((error) => {
            console.error("Error fetching content document ID:", error);
          });
      } else {
        console.error("Content version ID is missing");
      }
    } catch (error) {
      console.error("Unexpected error in viewContentVersion:", error);
    }
  }

  async handleSearch(event) {
    const searchTerm = event.target.value.trim();
    this.searchTerm = searchTerm; // Update the search term

    if (!this.allTemplates || this.allTemplates.length === 0) {
      try {
        await this.loadAllTemplates();
      } catch (error) {
        console.error("Error loading templates:", error);
        this.filteredTemplates = [];
      }
    }

    if (!searchTerm) {
      this.contentTitle = "Relevant Content"; // Reset content title
    } else {
      this.contentTitle = "Search Results";
    }

    // Update displayed items, which applies search to both templates and projects
    this.updateDisplayedItems();
  }

  performSearch(searchTerm) {
    if (searchTerm) {
      this.contentTitle = "Search Results";

      const lowerSearchTerm = searchTerm.toLowerCase();

      // Perform search for exact and case-insensitive matches
      this.filteredTemplates = this.allTemplates.filter((template) => {
        const name = template.name || "";
        const title = template.title || "";
        const categories = template.categories || [];

        const matchesName =
          name.includes(searchTerm) ||
          name.toLowerCase().includes(lowerSearchTerm);
        const matchesTitle =
          title.includes(searchTerm) ||
          title.toLowerCase().includes(lowerSearchTerm);
        const matchesCategories = categories.some((category) =>
          category.values?.some(
            (value) =>
              value.includes(searchTerm) ||
              value.toLowerCase().includes(lowerSearchTerm)
          )
        );

        return matchesName || matchesTitle || matchesCategories;
      });
    } else {
      // Reset to the original filtered templates
      this.contentTitle = "Relevant Content";
      this.filteredTemplates = [...this.originalTemplates];
    }

    // Reset displayed templates and pagination
    this.displayedTemplates = this.filteredTemplates.slice(
      0,
      this.currentOffset || 10
    );
    this.currentOffset = 10;

    // Update UI
    this.updateRowClasses();
  }

  updateRowClasses() {
    const templateRows = this.template.querySelectorAll(".template-row");
    templateRows.forEach((row) => row.classList.remove("no-border"));
    if (templateRows.length === 1) {
      templateRows[0].classList.add("no-border");
    }
  }

  async openModal(event) {
    try {
      // Reset selected template values
      this.selectedTemplateName = null;
      this.selectedTemplateId = null;

      // Retrieve dataset values from the event target
      this.selectedTemplateName = event.currentTarget.dataset.name;
      this.selectedTemplateId = event.currentTarget.dataset.id;
      const projectId = event.currentTarget.dataset.projectId;

      // Log retrieved values for debugging
      // console.log('Selected Template ID:', this.selectedTemplateId);
      // console.log('Selected Template Name:', this.selectedTemplateName);
      // console.log('Project ID:', projectId);

      // Open the modal and add the event listener
      this.isModalOpen = true;
      window.addEventListener("message", this.handleWindowMessage.bind(this));

      // Set loading state for the iframe
      this.isLoading = true;
      this.cycleLoadingText();

      // Find the selected template from all templates
      const selectedTemplate = this.allTemplates.find(
        (template) => template.id === this.selectedTemplateId
      );

      if (selectedTemplate) {
        const templateTitle = selectedTemplate.name; // Get the template title

        if (selectedTemplate.hasRelatedContent) {
          this.setupIframeSourceForEdit(this.selectedTemplateId, projectId);
        } else {
          await this.setupIframeSourceForCreate(
            this.selectedTemplateId,
            templateTitle
          ); // Await here
        }
      } else {
        console.error("Selected template not found:", this.selectedTemplateId);
        this.isLoading = false; // Ensure loading state is removed in case of error
      }
    } catch (error) {
      console.error("Error in openModal:", error);
      this.isLoading = false; // Ensure loading state is removed in case of error
    }
  }

  async setupIframeSourceForCreate(templateId, templateTitle) {
    this.iframeSrc = null;
    try {
      if (this.objectName === "Opportunity") {
        await this.triggerSendData();
      }

      const projectName = this.recordName
        ? `${templateTitle} - ${this.recordName}`
        : templateTitle;

      const response = await createProject({
        recordId: this.recordId,
        templateId: templateId,
        templateTitle: projectName,
        objectName: this.objectName
      });

      if (response.success) {
        // console.log("Project created successfully:", response.project_info);
        const projectInfo = response.project_info;
        const documentId = projectInfo.id;
        const thumbnailUri = projectInfo.thumbnailUri;

        const baseUrl = "https://app.marq.com";
        const samlDomain = this.customSAMLlogin
          ? `samlDomain=${encodeURIComponent(this.customSAMLlogin)}&`
          : "";
        const features = this.parseFeatures();
        const fileTypes = this.parseFileTypes();
        const showTabs = this.parseShowTabs();

        const embeddedOptions = {
          enabledFeatures: features,
          fileTypes: fileTypes,
          showTabs: showTabs
        };
        const encodedOptions = encodeURIComponent(
          btoa(JSON.stringify(embeddedOptions))
        );

        // Update to get the response as an object
        const saveProjectInfoResponse = await saveProjectInfo({
          recordId: this.recordId,
          projectId: documentId,
          thumbnailUrl: thumbnailUri,
          projectName: projectName,
          encodedOptions: encodedOptions,
          templateId: templateId,
          stageName: this.stageName
        });

        const saveProjectInfoResult = JSON.parse(saveProjectInfoResponse);

        if (saveProjectInfoResult && saveProjectInfoResult.contentVersionId) {
          const contentVersionId = saveProjectInfoResult.contentVersionId;
          // console.log(
          //   "Content Version created successfully:",
          //   saveProjectInfoResult.contentVersionId
          // );

          if (!contentVersionId) {
            console.error(
              "Invalid ContentVersionId returned from saveProjectInfo."
            );
            throw new Error("Failed to retrieve a valid ContentVersionId.");
          }

          const lastModifiedDate = new Date().toISOString();

          // Store the recent change
          this.recentChanges[`${templateId}-${this.recordId}`] = {
            projectId: documentId,
            projectName: projectName,
            contentVersionId: saveProjectInfoResult.contentVersionId,
            lastModifiedDate: lastModifiedDate
          };

          // Remove template from deletedTemplates if it was recreated
          this.deletedTemplates = this.deletedTemplates.filter(
            (id) => id !== templateId
          );

          // Refresh displayed templates
          this.updateTextboxFilters();
        } else {
          console.error(
            "Failed to create Content Version. The returned ID is invalid:",
            saveProjectInfoResult
          );
          throw new Error(
            "Failed to create Content Version. Check logs for details."
          );
        }

        const returnUrl = `${baseUrl}/documents/showIframedEditor/${documentId}/0?embeddedOptions=${encodedOptions}`;
        this.iframeSrc = `${baseUrl}/documents/iframe?${samlDomain}newWindow=false&returnUrl=${encodeURIComponent(
          returnUrl
        )}#/`;
      } else {
        console.error("Failed to create project:", response.error);
        this.showToast("Error", "Failed to create project:", response.error);
        this.closeModal();
      }
    } catch (error) {
      console.error("Problem setting up iframe:", error.message, error); // Log the full error object
      this.showToast(
        "Error",
        "Failed to create project: " + error.message,
        "error"
      );
      this.closeModal();
    } finally {
      this.isLoading = false;
    }
  }

  async setupIframeSourceForEdit(templateId, projectId) {
    this.iframeSrc = null;
    try {
      if (this.objectName === "Opportunity") {
        await this.triggerSendData();
      }

      // console.log('Setting up iframe for edit:', templateId, projectId);
      const baseUrl = "https://app.marq.com";
      const samlDomain = this.customSAMLlogin
        ? `samlDomain=${encodeURIComponent(this.customSAMLlogin)}&`
        : "";

      let dataoptions = "";
      if (templateId === "9cfbb5b9-32e6-4f93-b849-d4781bd9c8c0") {
        const dataSetId = "Salesforce"; // this.marqdataSetId;
        const key = "Id"; // this.key;
        const value = this.recordId; // this.value;
        const dataSetType = "Custom"; // this.marqdataSetType;

        dataoptions = this.buildDataOptions(dataSetType, dataSetId, key, value);
      }

      const features = this.parseFeatures();
      const fileTypes = this.parseFileTypes();
      const showTabs = this.parseShowTabs();

      const embeddedOptions = {
        enabledFeatures: features,
        fileTypes: fileTypes,
        showTabs: showTabs
      };
      const encodedOptions = encodeURIComponent(
        btoa(JSON.stringify(embeddedOptions))
      );

      // const returnUrl = ${baseUrl}/documents/editNewIframed/${projectId}?${dataoptions};
      const returnUrl = `${baseUrl}/documents/showIframedEditor/${projectId}/0?embeddedOptions=${encodedOptions}`;
      this.iframeSrc = `${baseUrl}/documents/iframe?${samlDomain}newWindow=false&returnUrl=${encodeURIComponent(
        returnUrl
      )}#/`;

      // this.iframeSrc = ${baseUrl}/documents/showIframedEditor/${projectId}/0?embeddedOptions=${encodedOptions}&${dataoptions};
      this.isLoading = false;
    } catch (error) {
      console.error("Error setting up iframe for edit:", error);
    }
  }

  handleImageError(event) {
    const img = event.target;
    const fallbackUrl = img_fallback;
    img.src = fallbackUrl;
  }

  closeSettingsModal() {
    this.isSettingsModalOpen = false;
  }

  closeModal() {
    this.isModalOpen = false;
    this.isLoading = true;
    window.removeEventListener("message", this.handleWindowMessage.bind(this));
    this.recheckTemplates();
  }

  async recheckTemplates() {
    await this.checkRelatedContentBatch(this.displayedTemplates);
    this.isLoading = false;
  }

  iframeLoaded() {}

  handleWindowMessage(event) {
    if (event.origin !== "https://app.marq.com") {
      return;
    }
    const messageData = event.data;
    if (messageData && messageData.type === "saveToEmbeddedPartner") {
      this.saveData(messageData);
      this.projectId = messageData.projectId;
      this.closeModal();
    }
  }

  saveData(messageData) {
    const encodedOptions = this.buildEncodedOptions();
    const templateKey = `${this.selectedTemplateId}-${this.recordId}`;

    // Check if there are recent changes for this template
    if (
      this.recentChanges[templateKey] &&
      this.recentChanges[templateKey].contentVersionId
    ) {
      const contentVersionId = this.recentChanges[templateKey].contentVersionId;

      // Update existing content version
      updateProjectInfo({
        contentVersionId: contentVersionId,
        downloadUrl: messageData.downloadUrl,
        projectName: messageData.projectName,
        mimeType: messageData.mimeType,
        projectId: messageData.projectId,
        encodedOptions: encodedOptions,
        templateId: this.selectedTemplateId
      })
        .then(() => {
          this.processUpdateProjectResponse(contentVersionId);

          const publicLink = this.publishedLinks[this.selectedTemplateId];
          if (publicLink) {
            this.publishFileById(
              contentVersionId,
              messageData.projectName,
              this.selectedTemplateId
            );
          } else {
            this.publishFileById(
              contentVersionId,
              messageData.projectName,
              this.selectedTemplateId
            );
          }
        })
        .catch((error) => {
          this.showToast(
            "Error",
            "Problem updating content version: " + error.body.message,
            "error"
          );
        });
    } else {
      // Check for existing ContentVersion by templateKey
      findRelatedContentVersionByTemplateKey({ templateKey: templateKey })
        .then((result) => {
          if (result && result.contentVersionId) {
            const contentVersionId = result.contentVersionId;

            // Update existing content version
            updateProjectInfo({
              contentVersionId: contentVersionId,
              downloadUrl: messageData.downloadUrl,
              projectName: messageData.projectName,
              mimeType: messageData.mimeType,
              projectId: messageData.projectId,
              encodedOptions: encodedOptions,
              templateId: this.selectedTemplateId
            })
              .then(() => {
                this.processUpdateProjectResponse(contentVersionId);

                const publicLink = this.publishedLinks[this.selectedTemplateId];
                if (publicLink) {
                  this.publishFileById(
                    contentVersionId,
                    messageData.projectName,
                    this.selectedTemplateId
                  );
                } else {
                  this.publishFileById(
                    contentVersionId,
                    messageData.projectName,
                    this.selectedTemplateId
                  );
                }
              })
              .catch((error) => {
                this.showToast(
                  "Error",
                  "Problem updating content version: " + error.body.message,
                  "error"
                );
              });
          } else {
            // Create new content version
            saveAsFileAndUpdateRecord({
              recordId: this.recordId,
              downloadUrl: messageData.downloadUrl,
              projectId: messageData.projectId,
              projectName: messageData.projectName,
              mimeType: messageData.mimeType,
              encodedOptions: encodedOptions,
              templateId: this.selectedTemplateId
            })
              .then((returnValue) => {
                this.processSaveDataResponse(returnValue);

                const publicLink = this.publishedLinks[this.selectedTemplateId];
                if (publicLink) {
                  this.publishFileById(
                    returnValue,
                    messageData.projectName,
                    this.selectedTemplateId
                  );
                } else {
                  this.publishFileById(
                    returnValue,
                    messageData.projectName,
                    this.selectedTemplateId
                  );
                }
              })
              .catch((error) => {
                this.showToast(
                  "Error",
                  "Problem saving file: " + error.body.message,
                  "error"
                );
              });
          }
        })
        .catch((error) => {
          this.showToast(
            "Error",
            "Problem fetching existing content version: " + error.body.message,
            "error"
          );
        });
    }
  }

  processUpdateProjectResponse(returnValue) {
    if (/^[a-zA-Z0-9]{15,18}$/.test(returnValue)) {
      this.closeModal();
      this.dispatchEvent(new RefreshEvent());
      const fileUrl = `/lightning/r/${returnValue}/view`;
      // this.showToast("Success", "The project has been saved", "success");
    } else {
      this.showToast(
        "Error",
        "Project saved, but the file ID is invalid or an error occurred: " +
          returnValue,
        "error"
      );
    }
  }

  processSaveDataResponse(returnValue) {
    if (/^[a-zA-Z0-9]{15,18}$/.test(returnValue)) {
      this.isModalOpen = false;
      this.isLoading = true;
      this.dispatchEvent(new RefreshEvent());
      setTimeout(() => {
        if (returnValue.startsWith("0QD")) {
          findRelatedContentVersionId({ quoteDocumentId: returnValue })
            .then((contentVersionId) => {
              this.updateContentVersion(contentVersionId);
            })
            .catch((error) => {
              console.error(
                "Failed to retrieve related ContentVersion ID or no ContentVersion found.",
                error
              );
            });
        } else {
          window.location.href = `/lightning/r/${returnValue}/view`;
        }
      }, 500);
      this.showToast("Success", "The file has been saved", "success");
    } else {
      this.showToast(
        "Error",
        "File saved, but the file ID is invalid or an error occurred: " +
          returnValue,
        "error"
      );
    }
  }

  updateContentVersion(contentVersionId) {
    const encodedOptions = this.buildEncodedOptions();
    updateContentVersionFields({
      contentVersionId: contentVersionId,
      projectId: this.projectId,
      encodedOptions: encodedOptions
    })
      .then(() => {
        this.dispatchEvent(new RefreshEvent());
      })
      .catch((error) => {
        console.error("Failed to update ContentVersion.", error);
      });
  }

  parseFeatures() {
    const features = [];
    const allFeatures = [
      { name: "lock", attribute: "enableLock" },
      { name: "download", attribute: "enableDownload" },
      { name: "print", attribute: "enablePrint" },
      { name: "collaborate", attribute: "enableCollaborate" },
      { name: "share", attribute: "enableShare" },
      { name: "saveName", attribute: "enableSaveName" },
      { name: "backButton", attribute: "enableBackButton" }
    ];
    allFeatures.forEach((feature) => {
      if (this[feature.attribute]) {
        features.push(feature.name);
      }
    });
    return features;
  }

  parseFileTypes() {
    const fileTypes = [];
    const allFileTypes = [
      { type: "pdf", attribute: "allowPDF" },
      { type: "jpg", attribute: "allowJPG" },
      { type: "png", attribute: "allowPNG" },
      { type: "gif", attribute: "allowGIF" },
      { type: "mp4", attribute: "allowMP4" }
    ];
    allFileTypes.forEach((fileType) => {
      if (this[fileType.attribute]) {
        fileTypes.push(fileType.type);
      }
    });
    return fileTypes;
  }

  parseShowTabs() {
    const showTabs = [];
    const allShowTabs = [
      { tab: "dashboard", attribute: "showDashboard" },
      { tab: "documents", attribute: "showDocuments" },
      { tab: "templates", attribute: "showTemplates" }
    ];
    allShowTabs.forEach((tab) => {
      if (this[tab.attribute]) {
        showTabs.push(tab.tab);
      }
    });
    return showTabs;
  }

  buildDataOptions(dataSetType, dataSetId, key, value) {
    let dataOptions = `dataSetType=${dataSetType}&dataSetId=${dataSetId}&key=${key}`;
    if (value) {
      dataOptions += `&value=${value}`;
    }
    return dataOptions;
  }

  buildEncodedOptions() {
    const features = this.parseFeatures();
    const fileTypes = this.parseFileTypes();
    const showTabs = this.parseShowTabs();

    const embeddedOptions = {
      enabledFeatures: features,
      fileTypes: fileTypes,
      showTabs: showTabs
    };
    return encodeURIComponent(btoa(JSON.stringify(embeddedOptions)));
  }

  showToast(title, message, variant) {
    const event = new ShowToastEvent({
      title: title,
      message: message,
      variant: variant
    });
    this.dispatchEvent(event);
  }

  refreshHandler() {
    return new Promise((resolve) => {
      this.refreshView();
      resolve(true);
    });
  }

  async refreshView() {
    refreshApex(this.wiredRecordResult);
    // Initialize filters
    try {
      await this.initFilters();
    } catch (filterError) {
      console.error(
        "Error initializing filters:",
        JSON.stringify(filterError, Object.getOwnPropertyNames(filterError))
      );
      throw new Error("Filter initialization failed.");
    }
    this.recheckTemplates();
  }

  cleanup() {
    unregisterRefreshHandler(this.refreshHandlerID);
    window.removeEventListener("message", this.handleWindowMessage.bind(this));
  }
}
