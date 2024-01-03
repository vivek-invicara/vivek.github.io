let entspa = {
    async getSpacePropSelects(input, libraries, ctx) {
        let { PlatformApi } = libraries
        let iaf_space_collection = await PlatformApi.IafScriptEngine.getVar('iaf_space_collection')
        let distinctFloors = await PlatformApi.IafScriptEngine.getDistinct({
            collectionDesc: { _userType: iaf_space_collection._userType, _id: iaf_space_collection._id },
            field: 'properties.Floor.val',
            query: {}
        }, ctx)
        distinctFloors = _.sortBy(distinctFloors, d => d._name)
        let distinctTypes = await PlatformApi.IafScriptEngine.getDistinct({
            collectionDesc: { _userType: iaf_space_collection._userType, _id: iaf_space_collection._id },
            field: 'properties.Type.val',
            query: {}
        }, ctx)
        distinctTypes = _.sortBy(distinctTypes, d => d._name)
        return { Floor: distinctFloors, Type: distinctTypes }
    },
    async getSpaces(input, libraries, ctx, callback) {
        console.log('input', input)
        const { IafScriptEngine } = libraries.PlatformApi
        let spaceColl = IafScriptEngine.getVar('iaf_space_collection')
        let relatedQuery = {
            parent: {
                query: input?.entityInfo || {},
                collectionDesc: { _userType: spaceColl._userType, _userItemId: spaceColl._userItemId },
                options: { page: { getAllItems: true } }
            },
            related: [
                {
                    relatedDesc: {
                        _relatedUserType: "rvt_elements",
                        //_relatedUserItemVersionId: elemColl._userItemVersionId
                    },
                    options: { project: { _id: 1, package_id: 1 } },
                    as: "revitElementIds"
                }
            ]
        }

        console.log(relatedQuery)

        let spaces = await IafScriptEngine.findWithRelated(relatedQuery, ctx).catch((err) => {
            return err
        })

        console.log(spaces)

        let spacesAsEntities = spaces._list.map((a) => {
            a.original = _.cloneDeep(a)
            a['Entity Name'] = a['Space Name']
            a.modelViewerIds = a.revitElementIds._list.map(e => e.package_id)
            return a
        })

        return spacesAsEntities

    },
    async spacesToAssets(input, libraries, ctx) {
        let { PlatformApi } = libraries
        let iaf_asset_collection = await PlatformApi.IafScriptEngine.getVar('iaf_asset_collection')
        console.log('input', input)
        let assetRoomQueries = input.entityInfo.selectedEntities.map(space => {
            return {
                query: { "properties.Room Number.val": space.properties["Number"].val  },
                collectionDesc: { _userType: iaf_asset_collection._userType, _userItemId: iaf_asset_collection._userItemId },
                options: {
                    page: { getAllItems: true },
                    project: { _id: 1, "Asset Name": 1, properties: 1 }
                }
            }
        })
        console.log('assetRoomQueries', assetRoomQueries)
        let assetIds = await PlatformApi.IafScriptEngine.getItemsMulti(assetRoomQueries, ctx)
        let selectedEntities = _.flatten(assetIds)
        console.log('selectedEntities', selectedEntities)
        return selectedEntities
    },
    async getDocumentsForSpace(input, libraries, ctx) {
        let { PlatformApi } = libraries
        let iaf_space_collection = await PlatformApi.IafScriptEngine.getVar('iaf_space_collection')
        console.log('input', input)
        //old script was using these roomVals that I think we dont need
        //let numberVals = input.entityInfo.selectedEntities.map()
        let spaceDoc_query = {
            parent: {
                query: { _id: input.entityInfo._id },
                collectionDesc: { _userType: iaf_space_collection._userType, _userItemId: iaf_space_collection._userItemId },
                options: { page: { getAllItems: true } }
            },
            related: [
                {
                    relatedDesc: { _relatedUserType: "file_container" },
                    as: "documents",
                    options: { page: { getAllItems: true } }
                }
            ]
        }
        let IAF_spacedoc_res = await PlatformApi.IafScriptEngine.findWithRelated(spaceDoc_query, ctx)
        console.log('IAF_spacedoc_res', IAF_spacedoc_res)
        return IAF_spacedoc_res._list[0].documents._list
    },
    async getSpaceImage(input, libraries, ctx) {
        if (input.entityInfo.properties['Image File Name'].val) {
            return { filename: input.entityInfo.properties['Image File Name'].val }
        } else {
            return null
        }
    },
    async getSpaceMatterportConfig(input, libraries, ctx) {
        if (input.entityInfo.properties['Scan View Url'].val) {
            return { url: input.entityInfo.properties['Scan View Url'].val }
        } else {
            return null
        }
    },
    async editSpace(input, libraries, ctx) {
        let { PlatformApi, UiUtils } = libraries
        let iaf_space_collection = PlatformApi.IafScriptEngine.getVar('iaf_space_collection')
        let IAF_workspace = await PlatformApi.IafScriptEngine.getVar('IAF_workspace')
        console.log('input', input)
        let res = {
            success: true,
            message: '',
            result: []
        }
        if (!_.isEmpty(input.entityInfo.new['Space Name'])) {
            let findasset = await PlatformApi.IafScriptEngine.findInCollections({
                query: { "Space Name": input.entityInfo.new['Entity Name'] },
                collectionDesc: {
                    _userType: iaf_space_collection._userType,
                    _userItemId: iaf_space_collection._userItemId
                },
                options: { page: { _pageSize: 10, getPageInfo: true } }
            }, ctx)
            let updateOK
            if (findasset._total > 0) {
                if (findasset._list[0]._id == input.entityInfo.new._id) {
                    updateOK = true
                } else {
                    updateOK = false
                }
            } else {
                updateOK = true
            }
            if (updateOK) {
                let updatedItemArray = [{
                    _id: input.entityInfo.new._id,
                    "Space Name": input.entityInfo.new['Entity Name'],
                    properties: input.entityInfo.new.properties
                }]
                let updateItemResult = await PlatformApi.IafScriptEngine.updateItemsBulk({
                    _userItemId: iaf_space_collection._userItemId,
                    _namespaces: IAF_workspace._namespaces,
                    items: updatedItemArray
                }, ctx);
                let updateRes = updateItemResult[0][0]
                if (updateRes === 'ok: 204') {
                    res.success = true
                    res.result = updateRes
                } else {
                    res.success = false
                    res.message = "Error updating Space!"
                }
            } else {
                res.success = false
                res.message = "Space with same name already exists!"
            }
        } else {
            res.success = false
            res.message = "Required Properties (Space Name) are missing values!"
        }
        return res
    },
    async getSpaceFromModelSystems(input, libraries, ctx) {
        let { PlatformApi } = libraries
        let iaf_space_collection = await PlatformApi.IafScriptEngine.getVar('iaf_space_collection')
        let iaf_ext_elements_collection = await PlatformApi.IafScriptEngine.getVar('iaf_ext_elements_collection')
        console.log('getSpaceFromModelSystems input', input)
        let bimQuery = [{
            parent: {
                query: { package_id: input.modelInfo.id },
                collectionDesc: { _userType: "rvt_elements", _userItemId: iaf_ext_elements_collection._userItemId },
                options: { page: { getAllItems: true } },
                sort: { _id: 1 }
            },
            relatedFilter: {
                includeResult: true,
                $and: [
                    { relatedDesc: { _relatedUserType: "rvt_type_elements" }, as: "Revit Type Properties" }
                ]
            },
            related: [
                { relatedDesc: { _relatedUserType: iaf_space_collection._userType, _isInverse: true }, as: 'SpaceInfo' },
                { relatedDesc: { _relatedUserType: "rvt_element_props" }, "as": "Revit Element Properties" }
            ]
        }]
        let queryResults = await PlatformApi.IafScriptEngine.findWithRelatedMulti(bimQuery, ctx)
        let space
        console.log('getSpaceFromModelSystems queryResults', queryResults)
        if (queryResults[0]._list[0].SpaceInfo._total > 0) {
            space = queryResults[0]._list[0].SpaceInfo._list.map(space => {
                return {
                    "Entity Name": space['Space Name'],
                    modelViewerIds: [input.modelId],
                    modelData: {
                        "id": queryResults[0]._list[0].package_id,
                        "revitGuid": queryResults[0]._list[0].source_id,
                        "dtCategory": queryResults[0]._list[0].dtCategory,
                        "dtType": queryResults[0]._list[0].dtType,
                        "Revit Type Properties": queryResults[0]._list[0]['Revit Type Properties']._list[0].properties,
                        "Revit Element Properties": queryResults[0]._list[0]['Revit Element Properties']._list[0].properties,
                    }
                }
            })
        } else {
            space = null
        }
        return space
    },
    async getSpaceFromModel(input, libraries, ctx) {
        let { PlatformApi } = libraries
        let iaf_space_collection = await PlatformApi.IafScriptEngine.getVar('iaf_space_collection')
        let iaf_ext_elements_collection = await PlatformApi.IafScriptEngine.getVar('iaf_ext_elements_collection')
        console.log('getSpaceFromModel input', input)
        let bimQuery = [{
            parent: {
                query: { package_id: input.modelInfo.id },
                collectionDesc: { _userType: "rvt_elements", _userItemId: iaf_ext_elements_collection._userItemId },
                options: { page: { getAllItems: true } },
                sort: { _id: 1 }
            },
            relatedFilter: {
                includeResult: true,
                $and: [
                    { relatedDesc: { _relatedUserType: "rvt_type_elements" }, as: "Revit Type Properties" }
                ]
            },
            related: [
                { relatedDesc: { _relatedUserType: iaf_space_collection._userType, _isInverse: true }, as: 'SpaceInfo' },
                { relatedDesc: { _relatedUserType: "rvt_element_props" }, "as": "Revit Element Properties" }
            ]
        }]
        let queryResults = await PlatformApi.IafScriptEngine.findWithRelatedMulti(bimQuery, ctx)
        let space
        console.log('getSpaceFromModel queryResults', queryResults)
        if (queryResults[0]._list[0].SpaceInfo._total > 0) {
            space = queryResults[0]._list[0].SpaceInfo._list.map(space => {
                return {
                    "Entity Name": space['Space Name'],
                    modelViewerIds: [input.modelId],
                    modelData: {
                        "id": queryResults[0]._list[0].package_id,
                        "revitGuid": queryResults[0]._list[0].source_id,
                        "dtCategory": queryResults[0]._list[0].dtCategory,
                        "dtType": queryResults[0]._list[0].dtType,
                        "Revit Type Properties": queryResults[0]._list[0]['Revit Type Properties']._list[0].properties,
                        "Revit Element Properties": queryResults[0]._list[0]['Revit Element Properties']._list[0].properties,
                    }
                }
            })
        } else {
            space = null
        }
        return space
    },
}

export default entspa