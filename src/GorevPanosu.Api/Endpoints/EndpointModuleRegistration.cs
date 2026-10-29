using System.Reflection;
using GorevPanosu.Api.Infrastructure;

namespace GorevPanosu.Api.Endpoints;

public sealed record EndpointModuleAssembly(Assembly Assembly);

public static class EndpointModuleRegistration
{
    public static IServiceCollection AddEndpointModuleAssembly(this IServiceCollection services, Assembly assembly)
    {
        services.AddSingleton(new EndpointModuleAssembly(assembly));
        return services;
    }

    public static IEndpointRouteBuilder MapRegisteredEndpointModules(this IEndpointRouteBuilder endpoints)
    {
        foreach (var assembly in endpoints.ServiceProvider.GetServices<EndpointModuleAssembly>()
                     .Select(registration => registration.Assembly).Distinct())
            endpoints.MapEndpointModules(assembly);
        return endpoints;
    }
}
