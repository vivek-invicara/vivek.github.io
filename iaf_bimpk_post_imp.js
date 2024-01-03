

const copyInverseRelationship = async (params, libraries, ctx) =>{
    
    const { PlatformApi,  IafScriptEngine} = libraries;

    console.log(JSON.stringify({"message":"Fetching Elements from Latest Collection"}));
   let model_rel_coll = await IafScriptEngine.getCollectionInComposite( 
                           params.compositeitemid,
                           {_userType: "rvt_elements"}
                           , ctx);
   let els_current_version = await IafScriptEngine.getItems( {
                           _userItemId: model_rel_coll._userItemId,
                           options: {
                               project: {
                                   source_id: 1,
                                   _id: 1
                               },
                               page: {
                                   getAllItems: true
                               },
                               sort: {
                                   "_id": 1
                               }
                           }
                       }, ctx);
   console.log(JSON.stringify({"message":"Fetching Previous Elements Collection"}));
   let model_rel_coll_prev = await IafScriptEngine.getCollectionInComposite( 
                           params.compositeitemid,
                           {_userType: "rvt_elements"}, ctx,
                            {"userItemVersionId": params.previousVersion._id}
                           );
   let els_prev_version = await IafScriptEngine.getItems({
                           _userItemId: model_rel_coll._userItemId,
                           options: {
                               project: {
                                   source_id: 1,
                                   _id: 1
                               },
                               page: {
                                   getAllItems: true
                                   
                               },
                               sort: {
                                   "_id": 1
                               },
                               userItemVersionId: model_rel_coll_prev._userItemVersionId
                           }
                       }, ctx);
     console.log(JSON.stringify({"message":"Mapping current version with previous version"}))
   els_current_version.forEach(x =>{
           let _val = els_prev_version.find(a=> a.source_id === x.source_id);
           x.previousVersionId = _val._id;

   });
     console.log(JSON.stringify({"message":"Fetching inverse relations"}))
   let els_inv_relationships_prev = await IafScriptEngine.getInverseRelations({
                           _userItemId: model_rel_coll._userItemId,
                           query: {
                               _relatedUserType: params.relatedUserType,

                           },
                           options: {
                               page: {
                                   getAllItems: true
                               },
                               sort: {
                                   "_id": 1
                               },
                               userItemVersionId: model_rel_coll_prev._userItemVersionId
                           }
                       }, ctx);   
    let _count = els_inv_relationships_prev.length;
    if (_count > 0){
        console.log(JSON.stringify({"message":`Found ${els_inv_relationships_prev.length} relationships to update`}));
    }else{
        console.log(JSON.stringify({"message":`Found ${els_inv_relationships_prev.length} relationships to update - Exiting`}));
        return true;
    }
                       
    
   let relationshipsToCreate = els_inv_relationships_prev.map(rels => rels._relatedToIds.map(_relatedToId =>({
           ...rels,
           _relatedToIds:_relatedToId

   }))).flat();                    
   console.log(JSON.stringify({"message":"Compiling relationships to create"}));
   relationshipsToCreate.forEach(x=>{
           x.parentItem = {_id: x._relatedToIds},
           x.relatedToItem = els_current_version.find( elsD => {
               return elsD.previousVersionId === x._relatedFromId
           }),
           x.elementUserItemVersionId = model_rel_coll_prev._userItemVersionId,
           x.elementUserItemVersion = model_rel_coll_prev._userItemVersion                 

   });
   console.log(JSON.stringify({"message":"Identifying missing relationships"}));
   let missingRelationShips = relationshipsToCreate.filter(x=>x.relatedToItem == undefined)
   .map((obj)=>{
       let retObj = {
       _relatedFromId: obj._relatedFromId,
       _relatedUserItemVersionId: obj._relatedUserItemVersionId,
       _isInverse: obj._isInverse,
       _relatedToIds: [
           obj._relatedToIds
       ],
       _relatedUserItemDbId:obj. _relatedUserItemDbId,
       _relatedUserType:obj._relatedUserType,
       _relatedUserItemClass: obj._relatedUserItemClass,
       _relatedUserItemId:obj._relatedUserItemId,
       _relatedUserItemVersion:obj._relatedUserItemVersion,
       _relatedFromUserItemVersionId: obj.elementUserItemVersionId,
       _relatedFromUserItemVersion: obj.elementUserItemVersion

       }
       return retObj;
   });
   console.log(JSON.stringify({"message":"Updating relationships"}))
   relationshipsToCreate = relationshipsToCreate.filter(x=>x.relatedToItem != undefined)
   .map((obj)=>{
       let retObj = {
           parentItem:obj.parentItem,
           relatedItems: [obj.relatedToItem],
           relatedUserItemId: obj._relatedUserItemId

       }
       return retObj;
   });
   
   await IafScriptEngine.createRelations({
           parentUserItemId: relationshipsToCreate[0].relatedUserItemId,
           _userItemId: model_rel_coll._userItemId,
           relations: relationshipsToCreate

   }, ctx);


   let els_coll = await IafScriptEngine.getCollection({ 
        _userItemId: model_rel_coll._userItemId

   }, ctx)
   let missingRelationsFile;
   if (missingRelationShips.length>0){
        console.log(JSON.stringify({"message":"Processing Missing Relationships"}))
       missingRelationsFile = 
           await IafScriptEngine.uploadJson({
           data: missingRelationShips,
           filename: els_coll._userItemId+"_missingRelsFromPrevVer_"+model_rel_coll_prev._userItemVersion+"_"+
                   params.relatedUserType+".json",
           _namespaces: ctx._namespaces
           },ctx);

   }
   if(missingRelationsFile){

       let missingRelations = {
           relatedUserType: params.relatedUserType,
           fileId: missingRelationsFile._id,
           fileVersionId: missingRelationsFile._tipI
       }
       let els_version = els_coll._versions[0];
       let els_userAttributes = Object.assign({},els_version._userAttributes);
       if (els_userAttributes.missingRelationsFromPrevVersion.length > 0){
           let missingRelationsFromPrevVersion = els_userAttributes.missingRelationsFromPrevVersion.concat(
               missingRelations);
       }
       console.log(JSON.stringify({"message":"Finally Updating versions"}))
       await IafScriptEngine.updateNamedUserItemVersion({

       userItemId: els_coll._id,
       userItemVersionId: els_coll._tipId,
       version: Object.assign(els_version,
                       {
                           _userAttributes: els_userAttributes
                       }
                   )
           
       },ctx);
   }
   return true;
}   

const validateParams = (params)=>{
   let errors = "";
   if (params.hasOwnProperty("relatedUserType")){
       if(!params.relatedUserType.length > 0 || typeof(params.relatedUserType) != "string"){
           return false;
       }

   }else{
       return false;
   }
   return true;
}

export default {

   async bimpkPostUpload(_params, libraries, ctx) {

    const { PlatformApi,  IafScriptEngine} = libraries;

    const {IafItemSvc} = PlatformApi

    debugger;

    let params = Object.assign(_params.inparams, _params.actualParams);
    let res = await IafItemSvc.getNamedUserItems({"query":{
                _id: params.compositeitemid,
                "_versions.all": true
            }},ctx,{});
    
    let bim_model = res._list[0];
    console.log(JSON.stringify({"message": "model -> "+JSON.stringify(bim_model)}));
       if (bim_model._versions.length > 1){
           let sortedModelVersions = bim_model._versions
           sortedModelVersions.sort((a,b)=>{
               return (b._version - a._version);

           });

           params.previousVersion = sortedModelVersions[1];
           if (validateParams(params)){

               return copyInverseRelationship(params,libraries,ctx);
           }else{

               let outparams = {
                   error:"Invalid or missing relatedUserType parameter"
               }
               console.log(JSON.stringify(outparams));
               return outparams;
           }


       }else{

           let outparams = {
               "message": "Intial Version Post Script not run"
           }
            console.log(JSON.stringify(outparams));
           return outparams;
       }   
   }
}

