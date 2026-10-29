using GorevPanosu.Api.Endpoints;
using GorevPanosu.Api.Infrastructure;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Routing;

namespace GorevPanosu.Api.Tests.Data;

public sealed class EndpointModuleTests
{
    [Fact]
    public async Task Factory_discovers_modules_from_registered_assembly()
    {
        using var factory = new AppFactory();
        using var host = factory.WithWebHostBuilder(builder => builder.ConfigureServices(services =>
            services.AddEndpointModuleAssembly(typeof(ProbeModule).Assembly)));
        using var client = host.CreateClient();
        Assert.Equal("discovered", await client.GetStringAsync("/test/module", TestContext.Current.CancellationToken));
    }
}

public sealed class ProbeModule : IEndpointModule
{
    public void Map(IEndpointRouteBuilder endpoints) => endpoints.MapGet("/test/module", () => "discovered");
}
