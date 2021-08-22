import {
    ClassDeclaration,
    Decorator,
    MethodDeclaration,
    ParameterDeclaration,
    PropertyDeclaration,
} from "ts-morph";

export interface PropTypeInfo {
    decor: Decorator;
    target: PropertyDeclaration;
}

export interface MethodTypeInfo {
    decor: Decorator;
    target: MethodDeclaration;
    params: ParamTypeInfo[];
}

export interface ParamTypeInfo {
    decor: Decorator;
    target: ParameterDeclaration;
}

export interface ClassTypeInfo {
    decor: Decorator;
    target: ClassDeclaration;
    properties: PropTypeInfo[];
    methods: MethodTypeInfo[];
}