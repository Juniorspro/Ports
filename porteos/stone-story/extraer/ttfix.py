# Arreglos al generador de typetrees de UnityPy para los DLL de Cpp2IL:
# List<string> sale como "string" (se leeria como texto) y m_Enabled sin alinear.
from UnityPy.helpers.TypeTreeGenerator import TypeTreeGenerator
from UnityPy.helpers.TypeTreeNode import TypeTreeNode
def generador(dlls):
    g = TypeTreeGenerator("2022.3.62f3"); g.load_local_dll_folder(dlls)
    def get_nodes_up(assembly, fullname, g=g):
        key = (assembly, fullname)
        if key in g.cache: return g.cache[key]
        if not assembly.endswith(".dll"): assembly += ".dll"
        b = g.get_nodes(assembly, fullname)
        tipos = []
        for i, n in enumerate(b):
            t, meta = n.m_Type, n.m_MetaFlag
            if t == 'string' and i + 3 < len(b) and b[i + 1].m_Type == 'Array' and b[i + 1].m_Level == n.m_Level + 1 and b[i + 3].m_Level == n.m_Level + 2 and b[i + 3].m_Name == 'data' and b[i + 3].m_Type == 'string':
                t = 'vector'
            tipos.append(TypeTreeNode(n.m_Level, t, n.m_Name, 0, 0, m_MetaFlag=meta))
        node = TypeTreeNode.from_list(tipos)
        g.cache[key] = node
        return node
    g.get_nodes_up = get_nodes_up
    return g
