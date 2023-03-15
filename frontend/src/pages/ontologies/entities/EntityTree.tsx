import {
	Checkbox,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup
} from "@mui/material";
import { Fragment, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../../app/hooks";
import { randomString } from "../../../app/util";
import LoadingOverlay from "../../../components/LoadingOverlay";
import Node from "../../../components/Node";
import Entity from "../../../model/Entity";
import Ontology from "../../../model/Ontology";
import {
  closeNode,
  disablePreferredRoots,
  enablePreferredRoots,
  getAncestors,
  getNodeChildren,
  getRootEntities,
  openNode,
  resetTreeContent,
  resetTreeSettings,
  showObsolete,
  hideObsolete,
  showCounts,
  hideCounts,
  TreeNode,
  hideSiblings,
  showSiblings
} from "../ontologiesSlice";

export default function EntityTree({
  ontology,
  entityType,
  selectedEntity,
  lang,
}: {
  ontology: Ontology;
  selectedEntity?: Entity;
  entityType: "entities" | "classes" | "properties" | "individuals";
  lang: string;
}) {

  const dispatch = useAppDispatch();
  const nodesWithChildrenLoaded = useAppSelector(
    (state) => state.ontologies.nodesWithChildrenLoaded
  );
  const nodeChildren = useAppSelector((state) => state.ontologies.nodeChildren);
  const rootNodes = useAppSelector((state) => state.ontologies.rootNodes);
  const numPendingTreeRequests = useAppSelector(
    (state) => state.ontologies.numPendingTreeRequests
  );
  const preferredRoots = useAppSelector(
    (state) => state.ontologies.preferredRoots
  );
  const automaticallyExpandedNodes = useAppSelector(
    (state) => state.ontologies.automaticallyExpandedNodes
  );
  const manuallyExpandedNodes = useAppSelector(
    (state) => state.ontologies.manuallyExpandedNodes
  );

  const showObsoleteEnabled = useAppSelector((state => state.ontologies.showObsolete));
  const showSiblingsEnabled = useAppSelector((state => state.ontologies.showSiblings));
  const showCountsEnabled = useAppSelector((state => state.ontologies.showCounts));

  const toggleNode = useCallback((node: any) => {

	let isExpanded = manuallyExpandedNodes.indexOf(node.absoluteIdentity) !== -1 ||
				automaticallyExpandedNodes.indexOf(node.absoluteIdentity) !== -1;

    if (isExpanded) {
      dispatch(closeNode(node));
    } else {
      dispatch(openNode(node));
    }
  }, [ dispatch, JSON.stringify(automaticallyExpandedNodes), JSON.stringify(manuallyExpandedNodes) ]);

  // If the ontology, entity type, selected entity IRI, or lang change, reset the tree settings (including showobsolete/preferred roots)
  useEffect(() => {
    dispatch(resetTreeSettings({entityType, selectedEntity }));
  }, [dispatch, ontology.getOntologyId(), entityType, selectedEntity?.getIri() ]);

  // If the ontology, entity type, selected entity, lang OR the showObsoleteEnabled/preferredRoots change, reset the tree content but not the settings
  useEffect(() => {
    dispatch(resetTreeContent());
  }, [dispatch, ontology.getOntologyId(), entityType, JSON.stringify(selectedEntity), showObsoleteEnabled, preferredRoots, lang]);

  useEffect(() => {

	// console.log('!!!! Dispatching API call')

	if (selectedEntity) {
		const entityIri = selectedEntity.getIri();
		let promise = dispatch(
			getAncestors({
			ontologyId: ontology.getOntologyId(),
			entityType,
			entityIri,
			lang,
			showObsoleteEnabled,
			showSiblingsEnabled
			})
		);
		return () => promise.abort() // component was unmounted
	} else {
		let promise = dispatch(
			getRootEntities({
			ontologyId: ontology.getOntologyId(),
			entityType,
			preferredRoots,
			lang,
			showObsoleteEnabled
			}))
		return () => promise.abort() // component was unmounted
	}

  }, [dispatch, entityType, JSON.stringify(selectedEntity), ontology.getOntologyId(), preferredRoots, lang, showObsoleteEnabled]);

  useEffect(() => {

	let nodesMissingChildren:string[] = manuallyExpandedNodes.filter(absoluteIdentity => nodesWithChildrenLoaded.indexOf(absoluteIdentity) === -1)

	if(showSiblingsEnabled) {
		nodesMissingChildren = [ ...nodesMissingChildren, ...automaticallyExpandedNodes.filter(absoluteIdentity => nodesWithChildrenLoaded.indexOf(absoluteIdentity) === -1) ]
	}

	console.log('!!!! Getting missing node children: ' + JSON.stringify(nodesMissingChildren));

	let promises:any = []

	for(let absId of nodesMissingChildren) {
		promises.push ( dispatch(
			getNodeChildren({
				ontologyId: ontology.getOntologyId(),
				entityTypePlural: entityType,
				entityIri: absId.split(';').pop(),
				absoluteIdentity: absId,
				lang,
				showObsoleteEnabled
			})
		) )
	}

	return () => {
		for(let promise of promises)
			promise.abort() // component was unmounted
	}

  }, [ dispatch, lang, JSON.stringify(manuallyExpandedNodes), JSON.stringify(automaticallyExpandedNodes), JSON.stringify(nodeChildren), ontology.getOntologyId(), entityType, preferredRoots, showObsoleteEnabled, showSiblingsEnabled ]);

  let toggleShowObsolete = useCallback(() => {

	if(showObsoleteEnabled) 
		dispatch(hideObsolete())
	else
		dispatch(showObsolete())

  }, [ dispatch, showObsoleteEnabled ]);

  let toggleShowSiblings = useCallback(() => {

	if(showSiblingsEnabled) 
		dispatch(hideSiblings())
	else
		dispatch(showSiblings())

  }, [ dispatch, showSiblingsEnabled ]);

  let toggleShowCounts = useCallback(() => {

	if(showCountsEnabled)
		dispatch(hideCounts())
	else
		dispatch(showCounts())

  }, [ dispatch, showCountsEnabled ]);

  function renderNodeChildren(
    children: TreeNode[],
    debugNumIterations: number
  ) {
    if (debugNumIterations > 100) {
      throw new Error("probable cyclic tree (renderNodeChildren)");
    }
    const childrenCopy = [...children];
    childrenCopy.sort((a, b) => {
      const titleA = a?.title ? a.title.toString().toUpperCase() : "";
      const titleB = b?.title ? b.title.toString().toUpperCase() : "";
      return titleA === titleB ? 0 : titleA > titleB ? 1 : -1;
    });
    const childrenSorted = childrenCopy.filter(
      (child, i, arr) =>
        !i || child.absoluteIdentity !== arr[i - 1].absoluteIdentity
    );
    return (
      <ul
        role="group"
        className="jstree-container-ul jstree-children jstree-no-icons"
      >
        {childrenSorted.map((childNode: TreeNode, i) => {
          const isExpanded =
            manuallyExpandedNodes.indexOf(childNode.absoluteIdentity) !== -1 || automaticallyExpandedNodes.indexOf(childNode.absoluteIdentity) !== -1;
          const isLast = i === childrenSorted!.length - 1;
          const highlight =
            (selectedEntity && childNode.iri === selectedEntity.getIri()) ||
            false;
          return (
            <Node
              expandable={childNode.expandable}
              expanded={isExpanded}
              highlight={highlight}
              isLast={isLast}
              onClick={() => {
                toggleNode(childNode);
              }}
              key={randomString()}
            >
		<TreeLink ontology={ontology} entity={childNode.entity} title={childNode.title} lang={lang} />
              { ( (!showObsoleteEnabled) && showCountsEnabled) && childNode.numDescendants > 0 && (
                <span style={{ color: "gray" }}>
                  {" (" + childNode.numDescendants.toLocaleString() + ")"}
                </span>
              )}
              {isExpanded &&
                renderNodeChildren(
                  nodeChildren[childNode.absoluteIdentity] || [],
                  debugNumIterations + 1
                )}
            </Node>
          );
        })}
      </ul>
    );
  }
  return (
    <Fragment>
      <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", right: 0, top: 0 }} className="flex flex-col">

		{ (entityType === 'classes' && ontology.getPreferredRoots().length > 0) && (
			<Fragment>
		<FormControl>
		<RadioGroup
			name="radio-buttons-group"
			value={preferredRoots ? "true" : "false"}
		>
			<FormControlLabel
			value="true"
			onClick={() => dispatch(enablePreferredRoots())}
			control={<Radio />}
			label="Preferred roots"
			/>
			<FormControlLabel
			value="false"
			onClick={() => dispatch(disablePreferredRoots())}
			control={<Radio />}
			label="All classes"
			/>
		</RadioGroup>
		</FormControl>
		 <br/>
		 </Fragment>
		)}

		 <FormControlLabel control={<Checkbox disabled={showObsoleteEnabled} checked={ (!showObsoleteEnabled) && showCountsEnabled} onClick={toggleShowCounts} />} label="Show counts" />
		 <FormControlLabel control={<Checkbox checked={showObsoleteEnabled} onClick={toggleShowObsolete} />} label="Show obsolete terms" />
		 { selectedEntity && <FormControlLabel control={<Checkbox checked={showSiblingsEnabled} onClick={toggleShowSiblings} />} label="Show all siblings" /> }
          </div>
        {rootNodes ? (
          <div className="px-3 jstree jstree-1 jstree-proton" role="tree">
            {renderNodeChildren(rootNodes, 0)}
          </div>
        ) : null}
        {numPendingTreeRequests > 0 ? <LoadingOverlay message="Loading..." /> : null}
      </div>
    </Fragment>
  );
}

function TreeLink({ontology,entity,title,lang}:{ontology:Ontology,entity:Entity,title:string,lang:string}) {

          let encodedIri = encodeURIComponent(encodeURIComponent(entity.getIri()));

	  let definedBy:string[] = entity.getDefinedBy()

	  if(definedBy.indexOf(ontology.getOntologyId()) !== -1)
		definedBy = []; // don't show definedBy links for terms in current ontology

	return <Link
                to={`/ontologies/${ontology.getOntologyId()}/${entity.getTypePlural()}/${encodedIri}?lang=${lang}`}
              >
                {title}
		{
			definedBy.length > 0 &&
				definedBy.map(definingOntology => {
				return <Link to={`/ontologies/${definingOntology}/${entity.getTypePlural()}/${encodedIri}?lang=${lang}`}>
					<span className="mx-1 link-ontology px-2 py-0 rounded-lg text-sm text-white uppercase ml-1" title={definingOntology} >
					{definingOntology}
					</span>
				</Link>

				})
		}
              </Link>

}